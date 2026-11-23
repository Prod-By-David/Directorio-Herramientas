import "server-only"
import { getStripe } from "@/lib/stripe"

/** Resumen (serializable) de una suscripción de Stripe, para mostrarlo al propietario en la ficha. */
export type SubscriptionSummary = {
  id: string
  status: string // active | trialing | past_due | canceled | ...
  cancelAtPeriodEnd: boolean
  /** Fin del periodo actual = próxima renovación (o fecha en que termina si está cancelada) */
  currentPeriodEnd: string | null
  amountCents: number | null
  currency: string | null
  interval: string | null
}

// Los campos de periodo/cancelación cambian de sitio entre versiones de la API de Stripe:
// se leen de forma tolerante (igual que en el webhook).
export function summarizeSubscription(sub: any): SubscriptionSummary {
  const item = sub?.items?.data?.[0]
  const end = item?.current_period_end ?? sub?.current_period_end
  const cancelAt = typeof sub?.cancel_at === "number" ? sub.cancel_at : null
  const periodEnd = typeof end === "number" ? end : cancelAt
  return {
    id: sub.id,
    status: sub.status,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end || cancelAt !== null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    amountCents: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency ?? null,
    interval: item?.price?.recurring?.interval ?? null,
  }
}

/** Estado real en Stripe. Devuelve null si no existe o si Stripe no responde (la ficha sigue funcionando). */
export async function getSubscriptionSummary(
  subId: string
): Promise<SubscriptionSummary | null> {
  try {
    const sub = await getStripe().subscriptions.retrieve(subId)
    return summarizeSubscription(sub)
  } catch (e: any) {
    if (e?.code !== "resource_missing") {
      console.error("No se pudo leer la suscripción", subId, e?.message)
    }
    return null
  }
}
