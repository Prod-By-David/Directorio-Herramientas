/**
 * Planes de listado destacado (una sola fuente de verdad: checkout, webhook y UI).
 *
 * IMPORTANTE: los importes distintos de 99 € son PROVISIONALES y deben
 * confirmarse con el responsable. El precio base del proyecto es 99 €
 * (BASE_PRICE_CENTS) y ningún plan puede costar menos.
 * Para añadir "semanas" basta con un plan nuevo con `days: 7 * n`.
 */
export type FeaturedPlan = {
  id: string
  label: string
  description: string
  kind: "one_time" | "subscription"
  amountCents: number
  currency: "eur"
  /** Solo pago único: días de destacado que se suman */
  days?: number
  /** Solo suscripción */
  interval?: "month"
}

export const BASE_PRICE_CENTS = 9900
export const TRIAL_DAYS = 7

export const FEATURED_PLANS: FeaturedPlan[] = [
  {
    id: "14d",
    label: "2 semanas (14 días)",
    description: "Pago único · precio base",
    kind: "one_time",
    amountCents: 9900,
    currency: "eur",
    days: 14,
  },
  {
    id: "30d",
    label: "30 días",
    description: "Pago único",
    kind: "one_time",
    amountCents: 17900,
    currency: "eur",
    days: 30,
  },
  {
    id: "90d",
    label: "90 días",
    description: "Pago único · mejor precio por día",
    kind: "one_time",
    amountCents: 44900,
    currency: "eur",
    days: 90,
  },
  {
    id: "monthly",
    label: "Suscripción mensual",
    description: "Se renueva cada mes · cancelable",
    kind: "subscription",
    amountCents: 14900,
    currency: "eur",
    interval: "month",
  },
]

for (const p of FEATURED_PLANS) {
  if (p.amountCents < BASE_PRICE_CENTS) {
    throw new Error(`El plan ${p.id} cuesta menos que el precio base de 99 €`)
  }
}

export function getPlan(id: string): FeaturedPlan | undefined {
  return FEATURED_PLANS.find((p) => p.id === id)
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(cents / 100)
}
