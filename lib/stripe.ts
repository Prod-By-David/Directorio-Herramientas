import "server-only"
import Stripe from "stripe"

/**
 * MODO PRUEBA por defecto. Mientras ALLOW_LIVE_PAYMENTS no sea exactamente
 * "true", cualquier clave sk_live_/rk_live_ se rechaza y los eventos live del
 * webhook se ignoran. Pasar a modo real es una decisión del responsable.
 */
export function isLiveAllowed() {
  return process.env.ALLOW_LIVE_PAYMENTS === "true"
}

let cached: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY no está definida")
  const isLiveKey = key.startsWith("sk_live_") || key.startsWith("rk_live_")
  if (isLiveKey && !isLiveAllowed()) {
    throw new Error(
      "MODO PRUEBA: se ha configurado una clave live de Stripe pero ALLOW_LIVE_PAYMENTS no es 'true'. Usa claves sk_test_."
    )
  }
  if (!cached) cached = new Stripe(key)
  return cached
}
