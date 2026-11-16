import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { getSupabaseEnv } from "./env"

export const createClient = async () => {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde un Server Component: se puede ignorar porque el
            // middleware ya refresca la sesión en cada petición.
          }
        },
      },
    }
  )
}
