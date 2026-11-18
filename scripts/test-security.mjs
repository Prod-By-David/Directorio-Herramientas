// Prueba de SEGURIDAD en modo prueba: crea 2 usuarios temporales y comprueba que la RLS, el trigger
// y los permisos por columna de la migración 20261116120000 funcionan de verdad. Todo se borra al terminar.
// Requisitos: migración aplicada. NO necesita el servidor en marcha. Uso: pnpm test:security
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const missing = [["NEXT_PUBLIC_SUPABASE_URL", url], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey], ["SUPABASE_SERVICE_ROLE_KEY", serviceKey]]
  .filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error(`Faltan variables en .env.local: ${missing.join(", ")}`)
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, opts)
const newClient = () => createClient(url, anonKey, opts)
const stamp = Date.now()
const future = new Date(Date.now() + 30 * 86_400_000).toISOString()
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // cabecera PNG mínima
let failures = 0

function check(name, cond, detail = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`)
  if (!cond) failures++
}
const errInfo = (r) => (r.error ? `${r.error.code ?? ""} ${r.error.message}`.trim() : "sin error (¡permitido!)")

async function makeUser(label) {
  const email = `security-test-${label}-${stamp}@example.com`
  const password = `Tmp-${stamp}-Aa1!`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw new Error(`No se pudo crear el usuario de prueba: ${created.error.message}`)
  const client = newClient()
  const signed = await client.auth.signInWithPassword({ email, password })
  if (signed.error) throw new Error(`No se pudo iniciar sesión con el usuario de prueba: ${signed.error.message}`)
  return { id: created.data.user.id, client }
}

const base = (n) => ({
  full_name: "Test", email: "security-test@example.com", twitter_handle: "@t",
  product_website: "https://example.com", codename: `sec-test-${stamp}-${n}`, punchline: "x",
  description: "temporal", logo_src: "", categories: "ai-tools", tags: [], labels: ["unlabeled"],
})

let A, B
const files = []
try {
  A = await makeUser("a")
  B = await makeUser("b")
  const anon = newClient()

  // --- Alta ---
  let r = await A.client.from("products").insert({ ...base("a"), user_id: A.id })
  check("Un usuario puede crear una herramienta (pendiente)", !r.error, errInfo(r))
  const { data: row } = await admin.from("products").select("id, approved, featured").eq("codename", `sec-test-${stamp}-a`).single()
  const productId = row?.id
  if (!productId) throw new Error("No se encontró el producto de prueba")
  check("Se guarda como pendiente y no destacado", row.approved === false && row.featured === false)

  r = await A.client.from("products").insert({ ...base("b"), user_id: A.id, approved: true })
  check("NO puede crear una herramienta ya aprobada", !!r.error, errInfo(r))
  r = await A.client.from("products").insert({ ...base("c"), user_id: A.id, featured: true, featured_until: future })
  check("NO puede crear una herramienta ya destacada", !!r.error, errInfo(r))
  r = await A.client.from("products").insert({ ...base("d"), user_id: B.id })
  check("NO puede crear herramientas a nombre de otro usuario", !!r.error, errInfo(r))

  // --- Edición ---
  r = await A.client.from("products").update({ approved: true }).eq("id", productId)
  check("NO puede auto-aprobarse (approved)", !!r.error, errInfo(r))
  r = await A.client.from("products").update({ featured: true, featured_until: future }).eq("id", productId)
  check("NO puede auto-destacarse (featured/featured_until)", !!r.error, errInfo(r))
  r = await A.client.from("products").update({ trial_used: false, view_count: 9999 }).eq("id", productId)
  check("NO puede tocar trial_used / view_count", !!r.error, errInfo(r))
  r = await A.client.from("products").update({ punchline: "editado" }).eq("id", productId)
  check("SÍ puede editar el contenido de su herramienta", !r.error, errInfo(r))
  const after = await admin.from("products").select("approved, featured, punchline").eq("id", productId).single()
  check("La BD conserva approved=false, featured=false y el texto editado",
    after.data?.approved === false && after.data?.featured === false && after.data?.punchline === "editado")

  // --- Lectura / privacidad ---
  r = await A.client.from("products").select("email").eq("id", productId)
  check("Con sesión de usuario el email NO es legible", !!r.error, errInfo(r))
  r = await A.client.from("products").select("id, approved").eq("id", productId)
  check("El dueño ve su herramienta pendiente", !r.error && r.data?.length === 1, errInfo(r))
  r = await B.client.from("products").select("id").eq("id", productId)
  check("Otro usuario NO ve la herramienta pendiente", !r.error && r.data?.length === 0, errInfo(r))
  r = await anon.from("products").select("id").eq("id", productId)
  check("Un anónimo NO ve la herramienta pendiente", !r.error && r.data?.length === 0, errInfo(r))

  // --- Tras aprobar (lo hace el servidor) ---
  await admin.from("products").update({ approved: true }).eq("id", productId)
  r = await anon.from("products").select("id").eq("id", productId)
  check("Aprobada: visible para cualquiera", !r.error && r.data?.length === 1, errInfo(r))
  const rpc = await anon.rpc("increment_product_view_count", { product_id: productId })
  const vc = await admin.from("products").select("view_count").eq("id", productId).single()
  check("El contador de visitas funciona con la clave pública", !rpc.error && vc.data?.view_count === 1, rpc.error ? errInfo(rpc) : `view_count=${vc.data?.view_count}`)

  r = await B.client.from("products").update({ punchline: "hack" }).eq("id", productId).select("id")
  const chk = await admin.from("products").select("punchline").eq("id", productId).single()
  check("Otro usuario NO puede editar una herramienta ajena", chk.data?.punchline === "editado", r.error ? errInfo(r) : `filas afectadas: ${r.data?.length ?? 0}`)
  r = await B.client.from("products").delete().eq("id", productId).select("id")
  const still = await admin.from("products").select("id").eq("id", productId)
  check("Otro usuario NO puede borrar una herramienta ajena", still.data?.length === 1, r.error ? errInfo(r) : `filas borradas: ${r.data?.length ?? 0}`)

  // --- Tablas auxiliares ---
  r = await anon.from("categories").insert({ name: `sec-test-${stamp}` })
  check("Un anónimo NO puede escribir en categories", !!r.error, errInfo(r))
  r = await A.client.from("tags").insert({ name: `sec-test-${stamp}` })
  check("Un usuario NO puede escribir en tags", !!r.error, errInfo(r))
  r = await A.client.from("stripe_events").select("id").limit(1)
  check("stripe_events no es accesible para usuarios", !!r.error || (r.data?.length ?? 0) === 0, errInfo(r))

  // --- Storage ---
  const mine = `${A.id}/sec-test-${stamp}.png`
  const other = `${B.id}/sec-test-${stamp}.png`
  files.push(mine, other)
  let up = await A.client.storage.from("product-logos").upload(mine, png, { contentType: "image/png" })
  check("Puede subir un logo a su propia carpeta", !up.error, up.error?.message ?? "")
  up = await A.client.storage.from("product-logos").upload(other, png, { contentType: "image/png" })
  check("NO puede subir a la carpeta de otro usuario", !!up.error, up.error?.message ?? "sin error (¡permitido!)")
} catch (e) {
  failures++
  console.error("Error inesperado:", e?.message ?? e)
} finally {
  try {
    if (files.length) await admin.storage.from("product-logos").remove(files)
    await admin.from("products").delete().like("codename", `sec-test-${stamp}-%`)
    await admin.from("categories").delete().eq("name", `sec-test-${stamp}`)
    await admin.from("tags").delete().eq("name", `sec-test-${stamp}`)
    if (A) await admin.auth.admin.deleteUser(A.id)
    if (B) await admin.auth.admin.deleteUser(B.id)
    console.log("\nLimpieza hecha (usuarios, productos y archivos de prueba borrados).")
  } catch (e) {
    console.error("Aviso: la limpieza falló; revisa usuarios/productos que empiecen por 'sec-test' o 'security-test':", e?.message ?? e)
  }
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : "\nTodo correcto")
process.exit(failures ? 1 : 0)