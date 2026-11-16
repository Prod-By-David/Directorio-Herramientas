import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createAdminClient } from "@/db/supabase/admin"
import { getStripe, isLiveAllowed } from "@/lib/stripe"
import { getPlan } from "@/lib/featured-plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_MS = 86_400_000
// Margen para que el reintento de cobro / el evento de renovación no deje huecos.
const SUBSCRIPTION_GRACE_MS = 12 * 60 * 60 * 1000

type Db = ReturnType<typeof createAdminClient>

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 400 })
  }

  // Cuerpo en bruto: imprescindible para verificar la firma
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err?.message}`)
    return NextResponse.json({ error: "Firma no válida" }, { status: 400 })
  }

  // MODO PRUEBA: los eventos reales se ignoran salvo autorización explícita.
  if (event.livemode && !isLiveAllowed()) {
    console.warn(`Evento live ${event.id} ignorado: ALLOW_LIVE_PAYMENTS no es 'true'`)
    return NextResponse.json({ received: true, ignored: "live_in_test_mode" })
  }

  const db = createAdminClient()

  // Idempotencia: Stripe reenvía eventos; cada id se procesa una sola vez.
  const { error: dupErr } = await db
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, livemode: event.livemode })
  if (dupErr) {
    if (dupErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error("No se pudo registrar el evento:", dupErr)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  try {
    await handleEvent(event, db)
  } catch (err) {
    // Se libera el id para que el reintento de Stripe pueda procesarlo.
    await db.from("stripe_events").delete().eq("id", event.id)
    console.error(`Error procesando ${event.type} (${event.id}):`, err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: Stripe.Event, db: Db) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return onCheckoutPaid(event.data.object as Stripe.Checkout.Session, db)
    case "invoice.paid":
      return onInvoicePaid(event.data.object as Stripe.Invoice, db)
    case "customer.subscription.deleted":
      return onSubscriptionDeleted(event.data.object as Stripe.Subscription, db)
    default:
      return
  }
}

async function onCheckoutPaid(session: Stripe.Checkout.Session, db: Db) {
  // Solo se activa si el cobro está confirmado (pagos asíncronos llegan en otro evento).
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return
  }

  const productId = session.metadata?.productId ?? session.client_reference_id
  const plan = getPlan(session.metadata?.planId ?? "")
  if (!productId || !plan) {
    console.warn(`Sesión ${session.id} sin metadata de producto/plan: ignorada`)
    return
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id

  if (session.mode === "subscription") {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id
    if (!subId) return
    const { periodEnd } = await getSubscriptionInfo(subId)
    await updateProduct(db, productId, {
      featured: true,
      featured_until: new Date(periodEnd + SUBSCRIPTION_GRACE_MS).toISOString(),
      stripe_subscription_id: subId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    return
  }

  // Pago único: se SUMAN los días a lo que quede vigente (no se pisa un destacado activo).
  const { data: current } = await db
    .from("products")
    .select("featured_until")
    .eq("id", productId)
    .maybeSingle()
  const currentUntil = current?.featured_until
    ? new Date(current.featured_until).getTime()
    : 0
  const base = Math.max(Date.now(), currentUntil)
  await updateProduct(db, productId, {
    featured: true,
    featured_until: new Date(base + (plan.days ?? 0) * DAY_MS).toISOString(),
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  })
}

// Renovaciones (y primera factura) de suscripción: alarga el destacado hasta el fin del periodo pagado.
async function onInvoicePaid(invoice: Stripe.Invoice, db: Db) {
  const subId = getInvoiceSubscriptionId(invoice)
  if (!subId) return
  const { periodEnd, metadata } = await getSubscriptionInfo(subId)
  const productId = metadata.productId
  if (!productId) return
  await updateProduct(db, productId, {
    featured: true,
    featured_until: new Date(periodEnd + SUBSCRIPTION_GRACE_MS).toISOString(),
    stripe_subscription_id: subId,
  })
}

// Suscripción cancelada o impagada: se retira el destacado.
async function onSubscriptionDeleted(sub: Stripe.Subscription, db: Db) {
  const { error } = await db
    .from("products")
    .update({
      featured: false,
      featured_until: new Date().toISOString(),
      stripe_subscription_id: null,
    })
    .eq("stripe_subscription_id", sub.id)
  if (error) throw error
}

async function updateProduct(db: Db, productId: string, values: Record<string, unknown>) {
  const { error } = await db.from("products").update(values).eq("id", productId)
  if (error) throw error
}

// Los campos de periodo/suscripción cambian de sitio entre versiones de la API de Stripe: se leen de forma tolerante.
async function getSubscriptionInfo(subId: string) {
  const sub: any = await getStripe().subscriptions.retrieve(subId)
  const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end
  if (typeof end !== "number") {
    throw new Error(`No se pudo leer el fin de periodo de la suscripción ${subId}`)
  }
  return {
    periodEnd: end * 1000,
    metadata: (sub.metadata ?? {}) as Record<string, string>,
  }
}

function getInvoiceSubscriptionId(invoice: any): string | null {
  const direct = invoice.subscription ?? invoice.parent?.subscription_details?.subscription
  if (!direct) return null
  return typeof direct === "string" ? direct : direct.id ?? null
}
