"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"
import { formatDate } from "@/lib/featured"
import { getStripe } from "@/lib/stripe"
import { summarizeSubscription } from "@/lib/subscription"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Result = { ok: boolean; message: string }

// Devuelve el id de suscripción de la herramienta SOLO si quien llama es su propietario.
async function getOwnedSubscription(
  productId: string
): Promise<{ subId: string } | { error: string }> {
  if (!UUID_RE.test(productId)) return { error: "Producto no válido" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Inicia sesión para continuar" }

  const { data, error } = await createAdminClient()
    .from("products")
    .select("user_id, stripe_subscription_id")
    .eq("id", productId)
    .maybeSingle()
  if (error || !data) return { error: "Herramienta no encontrada" }
  if (data.user_id !== user.id) return { error: "No autorizado" }
  if (!data.stripe_subscription_id)
    return { error: "Esta herramienta no tiene una suscripción activa" }
  return { subId: data.stripe_subscription_id }
}

function refresh(productId: string) {
  revalidatePath(`/products/${productId}`)
  revalidatePath("/products")
  revalidatePath("/")
  revalidatePath("/admin")
}

/**
 * Cancela la suscripción de una herramienta propia.
 * - "period_end": deja de renovarse; sigue destacada hasta el final del periodo ya pagado
 *   (Stripe enviará customer.subscription.deleted al terminar y el webhook retirará el destacado).
 * - "now": cancelación inmediata; se retira el destacado en el acto. No hay reembolso automático.
 */
export async function cancelMySubscription(
  productId: string,
  mode: "period_end" | "now"
): Promise<Result> {
  const owned = await getOwnedSubscription(productId)
  if ("error" in owned) return { ok: false, message: owned.error }

  try {
    if (mode === "period_end") {
      const sub = await getStripe().subscriptions.update(owned.subId, {
        cancel_at_period_end: true,
      })
      const end = summarizeSubscription(sub).currentPeriodEnd
      refresh(productId)
      return {
        ok: true,
        message: end
          ? `La suscripción no se renovará. Seguirá destacada hasta el ${formatDate(end)}.`
          : "La suscripción no se renovará.",
      }
    }

    try {
      await getStripe().subscriptions.cancel(owned.subId)
    } catch (e: any) {
      // Ya no existe en Stripe (p. ej. cancelada desde su panel): se limpia igualmente
      if (e?.code !== "resource_missing") throw e
    }
    const { error } = await createAdminClient()
      .from("products")
      .update({
        featured: false,
        featured_until: new Date().toISOString(),
        stripe_subscription_id: null,
      })
      .eq("id", productId)
    if (error) return { ok: false, message: "Cancelada en Stripe, pero no se pudo actualizar la ficha" }
    refresh(productId)
    return { ok: true, message: "Suscripción cancelada. Se ha retirado el destacado." }
  } catch (e: any) {
    console.error("Error cancelando la suscripción:", e?.message)
    return { ok: false, message: "No se pudo cancelar la suscripción. Inténtalo de nuevo." }
  }
}

/** Revierte una cancelación programada (mientras no haya terminado el periodo pagado). */
export async function resumeMySubscription(productId: string): Promise<Result> {
  const owned = await getOwnedSubscription(productId)
  if ("error" in owned) return { ok: false, message: owned.error }

  try {
    await getStripe().subscriptions.update(owned.subId, {
      cancel_at_period_end: false,
    })
    refresh(productId)
    return { ok: true, message: "Suscripción reanudada: se renovará con normalidad." }
  } catch (e: any) {
    console.error("Error reanudando la suscripción:", e?.message)
    return { ok: false, message: "No se pudo reanudar la suscripción." }
  }
}
