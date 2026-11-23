// Reenvía los webhooks de Stripe (modo prueba) a la app local, SIN "stripe login":
// usa STRIPE_SECRET_KEY (sk_test_) como credencial. Uso: pnpm stripe:listen   (con pnpm dev en marcha)
import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const clean = (v) => (v ?? "").replace(/\s+/g, "").replace(/^["']+|["']+$/g, "")
const mask = (s) => `${s.slice(0, 10)}…${s.slice(-4)}`

const EVENTS = "checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,customer.subscription.deleted"
const target = process.env.STRIPE_FORWARD_TO || "localhost:3000/api/webhooks/stripe"
const key = clean(process.env.STRIPE_SECRET_KEY)

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY debe ser una clave de pruebas (sk_test_…). Revisa .env.local o tus Codespaces secrets.")
  process.exit(1)
}

const version = spawnSync("stripe", ["--version"], { encoding: "utf8" })
if (version.error || version.status !== 0) {
  console.error("La Stripe CLI no está instalada. Instálala con:  bash .devcontainer/install-stripe-cli.sh")
  process.exit(1)
}

// 1) Secreto de firma de esta sesión (no hace falta 'stripe login' al usar --api-key)
const res = spawnSync("stripe", ["listen", "--api-key", key, "--events", EVENTS, "--forward-to", target, "--print-secret"], { encoding: "utf8" })
const secret = `${res.stdout ?? ""} ${res.stderr ?? ""}`.split(/\s+/).find((w) => w.startsWith("whsec_"))
if (!secret) {
  console.error("No se pudo obtener el secreto del webhook:\n" + (res.stderr || res.stdout || res.error?.message || "(sin salida)"))
  process.exit(1)
}

// 2) ¿Coincide con el que usa la app?
const current = clean(process.env.STRIPE_WEBHOOK_SECRET)
if (secret === current) {
  console.log(`✔ STRIPE_WEBHOOK_SECRET ya coincide (${mask(secret)})`)
} else if (existsSync(".env.local")) {
  const file = readFileSync(".env.local", "utf8")
  const re = /^STRIPE_WEBHOOK_SECRET=.*$/m
  const line = `STRIPE_WEBHOOK_SECRET="${secret}"`
  writeFileSync(".env.local", re.test(file) ? file.replace(re, line) : file.replace(/\s*$/, "\n") + line + "\n")
  console.log(`! El secreto de esta sesión (${mask(secret)}) era distinto: .env.local actualizado.`)
  console.log("  >>> REINICIA pnpm dev (Ctrl+C y pnpm dev) para que la app lo use.")
  if (current && re.test(file) && clean(file.match(re)[0].split("=").slice(1).join("=")) !== current) {
    console.log("  Aviso: STRIPE_WEBHOOK_SECRET también está definido como Codespaces secret y ese valor tiene prioridad; actualízalo allí.")
  }
} else {
  // No hay .env.local (Codespace nuevo): se crea solo con este valor; el resto puede venir de Codespaces secrets
  writeFileSync(".env.local", `STRIPE_WEBHOOK_SECRET="${secret}"\n`)
  console.log(`! No había .env.local: se ha creado con STRIPE_WEBHOOK_SECRET (${mask(secret)}).`)
  console.log("  >>> Si pnpm dev ya estaba en marcha, REINÍCIALO (Ctrl+C y pnpm dev).")
}

// 3) Reenvío de eventos
console.log(`\nReenviando ${EVENTS.split(",").length} tipos de evento a http://${target}  (Ctrl+C para parar)\n`)
const child = spawn("stripe", ["listen", "--api-key", key, "--events", EVENTS, "--forward-to", target], { stdio: "inherit" })
child.on("exit", (code) => process.exit(code ?? 0))
