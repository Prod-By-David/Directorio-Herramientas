"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"
import { TRIAL_DAYS } from "@/lib/featured-plans"
import { isFeaturedActive } from "@/lib/featured"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Prueba gratuita de destacado (una vez por herramienta, solo su dueño, solo si está aprobada). */
export async function startFeaturedTrial(
  productId: string
): Promise<{ ok: boolean; message: string }> {
  if (!UUID_RE.test(productId)) return { ok: false, message: "Producto no válido" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "Inicia sesión para continuar" }

  const admin = createAdminClient()
  const { data: product, error } = await admin
    .from("products")
    .select("id, user_id, approved, trial_used, featured, featured_until")
    .eq("id", productId)
    .maybeSingle()

  if (error || !product) return { ok: false, message: "Herramienta no encontrada" }
  if (product.user_id !== user.id) return { ok: false, message: "No autorizado" }
  if (!product.approved)
    return { ok: false, message: "La herramienta aún no está aprobada" }
  if (product.trial_used)
    return { ok: false, message: "La prueba gratuita ya se utilizó" }
  if (isFeaturedActive(product))
    return { ok: false, message: "La herramienta ya está destacada" }

  const until = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
  // Condición trial_used=false en el UPDATE: evita doble uso por peticiones simultáneas.
  const { data: updated, error: upErr } = await admin
    .from("products")
    .update({ featured: true, featured_until: until, trial_used: true })
    .eq("id", productId)
    .eq("trial_used", false)
    .select("id")

  if (upErr || !updated || updated.length === 0)
    return { ok: false, message: "No se pudo activar la prueba" }

  revalidatePath("/")
  revalidatePath("/products")
  revalidatePath(`/products/${productId}`)
  return { ok: true, message: `Destacada gratis durante ${TRIAL_DAYS} días` }
}
