"use server"

import "server-only"
import { cache } from "react"
import { revalidatePath } from "next/cache"
import { createClient } from "@/db/supabase/server"

export async function getFilters() {
  const db = createClient()
  
  const [categoriesRes, labelsRes, tagsRes] = await Promise.all([
    db.from("products").select("categories").eq("approved", true),
    db.from("products").select("labels").eq("approved", true),
    db.from("products").select("tags").eq("approved", true),
  ])

  if (categoriesRes.error || labelsRes.error || tagsRes.error) {
    console.error(
      "Error fetching filters:",
      categoriesRes.error,
      labelsRes.error,
      tagsRes.error
    )
    return { categories: [], labels: [], tags: [] }
  }

  return {
    categories: Array.from(new Set(categoriesRes.data.map((item) => item.categories).filter(Boolean))),
    labels: Array.from(new Set(labelsRes.data.flatMap((item) => item.labels).filter(Boolean))),
    tags: Array.from(new Set(tagsRes.data.flatMap((item) => item.tags).filter(Boolean))),
  }
}

export const getProducts = cache(
  async (
    searchTerm?: string,
    category?: string,
    label?: string,
    tag?: string
  ) => {
    const db = createClient()
    let query = db
      .from("products")
      .select("*")
      .eq("approved", true) // Seguridad: solo mostrar productos aprobados públicamente
      .order("is_featured", { ascending: false }) // Comercial: Los de 99€ destacados van primero
      .order("created_at", { ascending: false })

    if (searchTerm) {
      query = query.or(
        `codename.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,punchline.ilike.%${searchTerm}%`
      )
    }

    if (category) {
      query = query.eq("categories", category)
    }

    if (label) {
      query = query.contains("labels", [label])
    }

    if (tag) {
      query = query.contains("tags", [tag])
    }

    const { data, error } = await query

    if (error) {
      console.error("Error searching resources:", error)
      return []
    }

    return data
  }
)

export async function getProductById(id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single() // Usamos single() para traer un solo objeto en lugar de un array

  if (error) {
    console.error("Error fetching product by ID:", error)
    return null
  }

  return data
}

export async function incrementClickCount(id: string) {
  const supabase = createClient()

  const { data, error } = await supabase.rpc("increment_product_view_count", {
    product_id: id,
  })

  if (error) {
    console.error("Error incrementing click count:", error)
  }

  revalidatePath("/products")
}

export async function getApprovedProducts() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('approved', true) 
    .order('is_featured', { ascending: false }) 
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error fetching approved products:", error)
    return []
  }
  
  return data
}