// Diagnóstico del entorno (modo prueba). Uso: pnpm doctor
// Lee .env.local si existe (y también las variables/secrets del entorno, p. ej. Codespaces).
const results = []
const ok = (name, detail = "") => results.push({ s: "OK", name, detail })
const warn = (name, detail = "") => results.push({ s: "AVISO", name, detail })
const fail = (name, detail = "") => results.push({ s: "FALLO", name, detail })

const env = process.env
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_EMAILS",
  "CRON_SECRET",
]

// 1) Variables
const missing = required.filter((k) => !env[k])
if (missing.length) fail("Variables de entorno", `faltan: ${missing.join(", ")}`)
else ok("Variables de entorno", "todas definidas")

// 2) Stripe en modo prueba
const sk = env.STRIPE_SECRET_KEY ?? ""
const pk = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
if (sk.startsWith("sk_test_") && (!pk || pk.startsWith("pk_test_"))) ok("Stripe en MODO PRUEBA")
else if (sk.startsWith("sk_live_") || pk.startsWith("pk_live_"))
  fail("Stripe", "hay claves LIVE: este proyecto debe estar en modo prueba")
else if (sk) warn("Stripe", "las claves no tienen el formato sk_test_/pk_test_")
if (env.ALLOW_LIVE_PAYMENTS === "true") warn("ALLOW_LIVE_PAYMENTS", "está en 'true': el modo real está permitido")
if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"))
  warn("STRIPE_WEBHOOK_SECRET", "debería empezar por whsec_")

// 3) URL pública (Codespaces)
if (env.CODESPACE_NAME) {
  const expected = `https://${env.CODESPACE_NAME}-3000.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`
  const site = env.NEXT_PUBLIC_SITE_URL
  if (site && /localhost/.test(site))
    warn("NEXT_PUBLIC_SITE_URL", `apunta a localhost; en Codespaces déjala vacía o usa ${expected}`)
  else ok("URL pública (Codespaces)", site || `se detecta sola (${expected})`)
}

// 4) Supabase
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY

async function rest(path, key, init = {}) {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
  })
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

if (url && anon && service) {
  try {
    const cols = await rest(
      "/rest/v1/products?select=id,featured,featured_until,trial_used,rejected_at,stripe_subscription_id&limit=1",
      service
    )
    if (cols.status === 200) ok("Migración aplicada", "columnas de destacados presentes")
    else fail("Migración", `ejecuta supabase/migrations/20261116120000_featured_security_fixes.sql (HTTP ${cols.status}: ${cols.body?.message ?? ""})`)

    const ev = await rest("/rest/v1/stripe_events?select=id&limit=1", service)
    if (ev.status === 200) ok("Tabla stripe_events")
    else fail("Tabla stripe_events", `no existe (HTTP ${ev.status})`)

    const cats = await rest("/rest/v1/categories?select=name&limit=1", anon)
    if (cats.status === 200 && Array.isArray(cats.body) && cats.body.length) ok("Categorías visibles (RLS)", "hay datos")
    else warn("Categorías", `sin datos o sin acceso público (HTTP ${cats.status})`)

    // Privacidad: con la anon key NO deben leerse email ni user_id
    const priv = await rest("/rest/v1/products?select=email,user_id&limit=1", anon)
    if (priv.status === 200) fail("Privacidad", "la anon key puede leer email/user_id de products (falta el GRANT por columnas)")
    else ok("Privacidad", `email y user_id no son legibles con la anon key (HTTP ${priv.status})`)

    const pub = await rest("/rest/v1/products?select=id,codename,featured,featured_until&limit=1", anon)
    if (pub.status === 200) ok("Lectura pública de productos aprobados")
    else fail("Lectura pública de productos", `HTTP ${pub.status}: ${pub.body?.message ?? ""}`)

    const bucket = await rest("/storage/v1/bucket/product-logos", service)
    if (bucket.status === 200) ok("Bucket product-logos")
    else fail("Bucket product-logos", `no existe (HTTP ${bucket.status}); lo crea la migración 20240520031444`)

    const users = await rest("/auth/v1/admin/users?per_page=1", service)
    if (users.status === 200 && users.body?.users?.length) ok("Usuarios registrados", "hay al menos uno")
    else warn("Usuarios", "no hay usuarios: regístrate en /login antes de probar el envío")
  } catch (e) {
    fail("Conexión con Supabase", String(e?.message ?? e))
  }
}

// 5) Admin
if (env.ADMIN_EMAILS) ok("ADMIN_EMAILS", `${env.ADMIN_EMAILS.split(",").length} email(s)`)

// Informe
const icon = { OK: "✔", AVISO: "!", FALLO: "✘" }
for (const r of results) console.log(`${icon[r.s]} [${r.s}] ${r.name}${r.detail ? " — " + r.detail : ""}`)
const fails = results.filter((r) => r.s === "FALLO").length
console.log(`\n${results.length - fails} correctas/avisos · ${fails} fallo(s)`)
process.exit(fails ? 1 : 0)
