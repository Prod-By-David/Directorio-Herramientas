import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { getPlan } from "@/lib/featured-plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  productId: z.string().uuid(),
  planId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
    }

    // Solo usuarios autenticados, y solo sobre sus propias herramientas aprobadas
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Inicia sesión" }, { status: 401 })
    }

    // El precio sale SIEMPRE del servidor (plan), nunca del cliente
    const plan = getPlan(parsed.data.planId)
    if (!plan) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: product } = await admin
      .from("products")
      .select("id, codename, user_id, approved")
      .eq("id", parsed.data.productId)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Herramienta no encontrada" }, { status: 404 })
    }
    if (product.user_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    if (!product.approved) {
      return NextResponse.json(
        { error: "La herramienta aún no está aprobada" },
        { status: 409 }
      )
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin
    const metadata = { productId: product.id, planId: plan.id, userId: user.id }
    const isSub = plan.kind === "subscription"

    const session = await getStripe().checkout.sessions.create({
      mode: isSub ? "subscription" : "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amountCents,
            product_data: {
              name: `Destacar «${product.codename}» · ${plan.label}`,
            },
            ...(isSub
              ? { recurring: { interval: plan.interval ?? ("month" as const) } }
              : {}),
          },
        },
      ],
      client_reference_id: product.id,
      metadata,
      ...(isSub
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
      success_url: `${origin}/products/${product.id}?checkout=success`,
      cancel_url: `${origin}/products/${product.id}?checkout=canceled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe Checkout Error:", error)
    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 }
    )
  }
}
