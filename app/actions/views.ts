"use server"

import { createClient } from "@/db/supabase/server"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function incrementClickCount(id: string) {
  if (!UUID_RE.test(id)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc("increment_product_view_count", {
    product_id: id,
  })
  if (error) console.error("Error incrementing click count:", error)
}
