import "server-only"
import { cache } from "react"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"
import { sortByRanking } from "@/lib/featured"
import { PRODUCT_PUBLIC_COLUMNS } from "@/lib/product-columns"
import type { PublicProduct } from "@/lib/types"

// Módulo de acceso a datos SOLO de servidor (ya no es "use server": sus
// funciones no se exponen como endpoints públicos).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalize(row: any): PublicProduct {
  return {
    ...row,
    tags: row.tags ?? [],
    labels: row.labels ?? [],
    view_count: row.view_count ?? 0,
    logo_src: row.logo_src || "/placeholder.png",
    categories: row.categories ?? "",
    featured: !!row.featured,
    featured_until: row.featured_until ?? null,
  }
}

export const getProducts = cache(
  async (
    searchTerm?: string,
    category?: string,
    label?: string,
    tag?: string
  ): Promise<PublicProduct[]> => {
    const db = await createClient()
    let query = db
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .eq("approved", true) // solo aprobados en el listado público

    // Se limpian los caracteres con significado en la sintaxis de filtros de PostgREST
    const term = searchTerm?.replace(/[,()%*\\]/g, " ").trim()
    if (term) {
      query = query.or(
        `codename.ilike.%${term}%,description.ilike.%${term}%,punchline.ilike.%${term}%`
      )
    }
    if (category) query = query.eq("categories", category)
    if (label) query = query.contains("labels", [label])
    if (tag) query = query.contains("tags", [tag])

    const { data, error } = await query
    if (error) {
      console.error("Error searching resources:", error)
      return []
    }
    // El ranking (destacados vigentes primero) se calcula aquí: no depende de que el cron haya corrido.
    return sortByRanking((data as unknown as any[]).map(normalize))
  }
)

/** Un producto por id. RLS: aprobados para todos; los pendientes solo los ve su dueño. */
export async function getProductById(id: string): Promise<PublicProduct | null> {
  if (!UUID_RE.test(id)) return null
  const db = await createClient()
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("Error fetching product by ID:", error)
    return null
  }
  return data ? normalize(data) : null
}

/** Propiedad y estado de prueba (datos no públicos) vía service role, tras comprobar el id. */
export async function getOwnerState(productId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("products")
    .select("user_id, trial_used")
    .eq("id", productId)
    .maybeSingle()
  return {
    isOwner: !!data && data.user_id === userId,
    trialUsed: !!data?.trial_used,
  }
}
