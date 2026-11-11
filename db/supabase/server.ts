import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // El método `set` fue llamado desde un Server Component.
            // Esto se puede ignorar si tienes un middleware actualizando sesiones.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // El método `remove/delete` fue llamado desde un Server Component.
            // Esto se puede ignorar si tienes un middleware actualizando sesiones.
          }
        },
      },
    }
  )
}