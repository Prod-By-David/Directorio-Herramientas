/**
 * Columnas públicas de `products`. Deben coincidir con el GRANT SELECT por
 * columnas de la migración 20261116120000 (email, full_name, user_id y datos de
 * Stripe NO son legibles con la anon key). Nunca usar select("*") desde el
 * cliente de usuario.
 */
export const PRODUCT_PUBLIC_COLUMNS: string =
  "id, created_at, twitter_handle, product_website, codename, punchline, description, logo_src, tags, labels, categories, view_count, approved, featured, featured_until"
