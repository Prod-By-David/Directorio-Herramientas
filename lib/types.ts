/** Campos de `products` que son públicos (los únicos con SELECT para anon/authenticated). */
export type PublicProduct = {
  id: string
  created_at: string
  twitter_handle: string
  product_website: string
  codename: string
  punchline: string
  description: string
  logo_src: string
  tags: string[]
  labels: string[]
  categories: string
  view_count: number
  approved: boolean
  featured: boolean
  featured_until: string | null
}
