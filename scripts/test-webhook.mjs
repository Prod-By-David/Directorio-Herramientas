// Prueba extremo a extremo del webhook de Stripe SIN pagar (modo prueba).
// Requisitos: servidor en marcha (pnpm dev), migración aplicada y al menos un usuario registrado.
// Uso: pnpm test:webhook        (opcional: TEST_BASE_URL=http://localhost:3000)
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env
const secret = process.env.STRIPE_WEBHOOK_SECRET
const base = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "")

const missingVars = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceKey],
  ["STRIPE_WEBHOOK_SECRET", secret],
].filter(([, v]) => !v).map(([k]) => k)
if (missingVars.length) {
  console.error(`Faltan variables en .env.local: ${missingVars.join(", ")}  (ejecuta antes: pnpm check:env)`)
  process.exit(1)
}
if ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")) {
  console.error("Clave live detectada: esta prueba solo se ejecuta en modo prueba")
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder")
const stamp = Date.now()
const DAY = 86_400_000
let failures = 0
const eventIds = []

function check(name, cond, detail = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`)
  if (!cond) failures++
}

async function send(event, { sign = true } = {}) {
  const payload = JSON.stringify(event)
  const header = sign
    ? stripe.webhooks.generateTestHeaderString({ payload, secret })
    : "t=1,v1=invalida"
  const res = await fetch(`${base}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

const checkoutEvent = (id, productId, extra = {}) => {
  eventIds.push(id)
  return {
    id, object: "event", created: Math.floor(Date.now() / 1000), type: "checkout.session.completed",
    livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null },
    data: { object: {
      id: `cs_test_${id}`, object: "checkout.session", mode: "payment", payment_status: "paid",
      metadata: { productId, planId: "14d" }, client_reference_id: productId, customer: null, subscription: null,
      ...extra,
    } },
  }
}

const getProduct = async (id) =>
  (await db.from("products").select("featured, featured_until").eq("id", id).single()).data

// --- preparación: producto aprobado de prueba ---
let userId = process.env.TEST_USER_ID
if (!userId) {
  const { data: usersData, error: usersErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1 })
  userId = usersData?.users?.[0]?.id
  if (!userId) {
    console.error(usersErr ? `No se pudo listar usuarios (${usersErr.message}).` : "No hay usuarios: regístrate en /login primero.")
    console.error("Alternativa: define TEST_USER_ID con el id de un usuario (Supabase > Authentication > Users).")
    process.exit(1)
  }
}

const { data: product, error: insErr } = await db.from("products").insert({
  full_name: "Prueba webhook", email: "webhook-test@example.com", twitter_handle: "@test",
  product_website: "https://example.com", codename: `test-webhook-${stamp}`, punchline: "Prueba",
  description: "Producto temporal de prueba (se borra al terminar)", logo_src: "", categories: "ai-tools",
  user_id: userId, approved: true, tags: [], labels: ["unlabeled"],
}).select("id").single()
if (insErr || !product) { console.error("No se pudo crear el producto de prueba:", insErr?.message); process.exit(1) }
const productId = product.id
console.log(`Producto de prueba ${productId} · servidor ${base}\n`)

try {
  // 1) Pago correcto -> destacado ~14 días
  const e1 = `evt_test_${stamp}_1`
  const r1 = await send(checkoutEvent(e1, productId))
  check("Firma válida -> 200", r1.status === 200, `HTTP ${r1.status} ${JSON.stringify(r1.json)}`)
  const p1 = await getProduct(productId)
  const d1 = p1?.featured_until ? (new Date(p1.featured_until).getTime() - Date.now()) / DAY : 0
  check("Destacado activado (plan 14d)", p1?.featured === true && Math.abs(d1 - 14) < 0.1, `featured=${p1?.featured}, días=${d1.toFixed(2)}`)

  // 2) Reenvío del mismo evento -> idempotente
  const r2 = await send(checkoutEvent(e1, productId))
  const p2 = await getProduct(productId)
  check("Evento repetido -> duplicate, sin efecto doble", r2.status === 200 && r2.json?.duplicate === true && p2.featured_until === p1.featured_until, JSON.stringify(r2.json))

  // 3) Segundo pago -> los días se suman
  const r3 = await send(checkoutEvent(`evt_test_${stamp}_3`, productId))
  const p3 = await getProduct(productId)
  const d3 = (new Date(p3.featured_until).getTime() - Date.now()) / DAY
  check("Segundo pago suma días (~28)", r3.status === 200 && Math.abs(d3 - 28) < 0.1, `días=${d3.toFixed(2)}`)

  // 4) Firma inválida
  const r4 = await send(checkoutEvent(`evt_test_${stamp}_4`, productId), { sign: false })
  check("Firma inválida -> 400", r4.status === 400, `HTTP ${r4.status}`)

  // 5) Evento live en modo prueba -> ignorado
  if (process.env.ALLOW_LIVE_PAYMENTS === "true") {
    console.log("- Evento live: omitido (ALLOW_LIVE_PAYMENTS=true)")
  } else {
    const live = checkoutEvent(`evt_test_${stamp}_5`, productId)
    live.livemode = true
    const r5 = await send(live)
    const p5 = await getProduct(productId)
    check("Evento LIVE ignorado en modo prueba", r5.status === 200 && r5.json?.ignored && p5.featured_until === p3.featured_until, JSON.stringify(r5.json))
  }

  // 6) Pago no confirmado -> no activa
  const r6 = await send(checkoutEvent(`evt_test_${stamp}_6`, productId, { payment_status: "unpaid" }))
  const p6 = await getProduct(productId)
  check("Pago no confirmado (unpaid) no cambia nada", r6.status === 200 && p6.featured_until === p3.featured_until)

  // 7) Caducidad + cron
  await db.from("products").update({ featured_until: new Date(Date.now() - 60_000).toISOString() }).eq("id", productId)
  if (process.env.CRON_SECRET) {
    const res = await fetch(`${base}/api/cron/expire-featured`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    const p7 = await getProduct(productId)
    check("Cron retira el destacado caducado", res.status === 200 && p7.featured === false, `HTTP ${res.status}`)
    const bad = await fetch(`${base}/api/cron/expire-featured`)
    check("Cron sin secreto -> 401", bad.status === 401, `HTTP ${bad.status}`)
  } else {
    console.log("- Cron: omitido (falta CRON_SECRET)")
  }
} catch (e) {
  failures++
  console.error("Error inesperado:", e)
} finally {
  await db.from("stripe_events").delete().in("id", eventIds)
  await db.from("products").delete().eq("id", productId)
  console.log("\nLimpieza hecha (producto y eventos de prueba borrados).")
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : "\nTodo correcto")
process.exit(failures ? 1 : 0)
