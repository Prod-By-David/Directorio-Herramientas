import "server-only"
import { cache } from "react"
import { createClient } from "@/db/supabase/server"

type FilterData = {
  categories: string[]
  labels: string[]
  tags: string[]
}

const unique = (array: string[]) => [...new Set(array)]

/** Filtros del sidebar: categorías (tabla + usadas) y labels/tags de productos aprobados. */
export const getCachedFilters = cache(async (): Promise<FilterData> => {
  const db = await createClient()
  const [catRes, prodRes] = await Promise.all([
    db.from("categories").select("name"),
    db.from("products").select("categories, labels, tags").eq("approved", true),
  ])

  if (catRes.error || prodRes.error) {
    console.error("Error fetching filters:", catRes.error, prodRes.error)
    return { categories: [], labels: [], tags: [] }
  }

  const prods = (prodRes.data ?? []) as {
    categories: string | null
    labels: string[] | null
    tags: string[] | null
  }[]

  const categories = unique([
    ...(catRes.data ?? []).map((c: { name: string }) => c.name),
    ...prods.map((p) => p.categories ?? ""),
  ]).filter(Boolean)

  const labels = unique(prods.flatMap((p) => p.labels ?? [])).filter(
    (l) => l && l !== "unlabeled"
  )
  const tags = unique(prods.flatMap((p) => p.tags ?? [])).filter(Boolean)

  return { categories, labels, tags }
})
