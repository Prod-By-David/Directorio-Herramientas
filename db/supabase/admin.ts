import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Cliente con la service role key. SOLO para código de servidor ya autorizado
 * (webhook de Stripe, cron, acciones de admin, comprobaciones de propiedad).
 * Usa supabase-js "plano" (sin cookies de usuario) para que se aplique la
 * service role y no el JWT de la persona que navega.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno"
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
