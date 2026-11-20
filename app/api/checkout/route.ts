import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { z } from "zod"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { getPlan } from "@/lib/featured-plans"

// "managed_payments" se declara aquí por si la versión del SDK aún no lo tipa
type CheckoutParams = Stripe.Checkout.SessionCreateParams & {
  managed_payments?: { enabled: boolean }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// URL pública de la app: variable de entorno si existe; si no, la de la petición
// (detrás de un proxy como Codespaces, el host real llega en x-forwarded-host).
function getOrigin(req: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv
  // Tras varios proxies estas cabeceras pueden venir como lista "a, b": se usa el primer valor
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"))
  const proto = first(req.headers.get("x-forwarded-proto")) ?? "http"
  return host ? `${proto}://${host}` : new URL(req.url).origin
}

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

    const origin = getOrigin(req)
    const metadata = { productId: product.id, planId: plan.id, userId: user.id }
    const isSub = plan.kind === "subscription"

    const params: CheckoutParams = {
      mode: isSub ? "subscription" : "payment",
      locale: "es",
      // Stripe activa "Managed Payments" por defecto en cuentas nuevas y entonces exige un tax_code
      // por producto ("the product tax code is missing"). Se desactiva en la sesión: checkout estándar.
      managed_payments: { enabled: false },
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
    }

    const session = await getStripe().checkout.sessions.create(params)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("Stripe Checkout Error:", {
      type: error?.type,
      code: error?.code,
      param: error?.param,
      message: error?.message,
    })
    // En modo prueba se devuelve el motivo real para poder corregirlo; en modo real, solo un mensaje genérico.
    const testMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")
    return NextResponse.json(
      {
        error: "No se pudo iniciar el pago",
        ...(testMode && error?.message ? { detail: String(error.message) } : {}),
      },
      { status: 500 }
    )
  }
}
