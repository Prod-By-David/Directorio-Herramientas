// Diagnóstico de Stripe en MODO PRUEBA, sin servidor ni navegador.
// Comprueba la clave, la cuenta y que Stripe acepta crear sesiones de pago (pago único y suscripción).
// Las sesiones de prueba se caducan al terminar. Uso: pnpm test:stripe
import Stripe from "stripe"

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error("Falta STRIPE_SECRET_KEY en .env.local")
  process.exit(1)
}
if (!key.startsWith("sk_test_")) {
  console.error("La clave no empieza por sk_test_: este diagnóstico solo funciona en modo prueba")
  process.exit(1)
}

const stripe = new Stripe(key)
let failures = 0
const created = []

console.log("Clave de prueba detectada. Consultando la cuenta de Stripe…")
try {
  const acct = await stripe.accounts.retrieve()
  const name = acct.business_profile?.name || acct.settings?.dashboard?.display_name
  console.log(`✔ Clave válida · cuenta ${acct.id} · país ${acct.country ?? "?"} · moneda ${acct.default_currency ?? "?"}`)
  if (!name) {
    console.log("! La cuenta no tiene nombre de empresa: Stripe Checkout puede rechazar las sesiones. Ponlo en Dashboard > Settings > Business > Public details.")
  } else {
    console.log(`✔ Nombre de la cuenta: ${name}`)
  }
} catch (e) {
  failures++
  console.error(`✘ La clave no es válida o no permite leer la cuenta — ${e.type ?? ""} ${e.message}`)
  console.error("  Si regeneraste la clave en Stripe, copia la NUEVA en STRIPE_SECRET_KEY y reinicia pnpm dev.")
}

const cases = [
  { label: "Pago único (plan 14d, 99 €)", mode: "payment", amount: 9900 },
  { label: "Suscripción mensual (149 €/mes)", mode: "subscription", amount: 14900, recurring: { interval: "month" } },
]

for (const c of cases) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: c.mode,
      locale: "es",
      managed_payments: { enabled: false }, // igual que app/api/checkout/route.ts
      customer_email: "stripe-test@example.com",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: c.amount,
          product_data: { name: `Prueba · ${c.label}` },
          ...(c.recurring ? { recurring: c.recurring } : {}),
        },
      }],
      metadata: { test: "true" },
      success_url: "https://example.com/?checkout=success",
      cancel_url: "https://example.com/?checkout=canceled",
    })
    created.push(session.id)
    console.log(`✔ ${c.label}: Stripe acepta crear la sesión (${session.id})`)
  } catch (e) {
    failures++
    console.error(`✘ ${c.label}: ${e.type ?? ""} ${e.code ?? ""} — ${e.message}`)
  }
}

for (const id of created) {
  try { await stripe.checkout.sessions.expire(id) } catch {}
}

console.log(failures ? `\n${failures} comprobación(es) fallida(s): ese mensaje es el motivo por el que falla el pago.` : "\nStripe responde bien: si el pago falla en la web, el motivo está en la app (mira la terminal de pnpm dev).")
process.exit(failures ? 1 : 0)
