import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { getSupabaseEnv, isSupabaseConfigured } from "./env"

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request })

  // Sin configuración no hay sesión que refrescar (el layout muestra la pantalla de configuración)
  if (!isSupabaseConfigured()) return response

  try {
    const { url, anonKey } = getSupabaseEnv()
    const supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresca la sesión si ha caducado (necesario para Server Components)
    await supabase.auth.getUser()
  } catch (e) {
    // Sin variables de entorno de Supabase no se puede crear el cliente:
    // se deja pasar la petición sin tocarla.
    console.error("Supabase middleware error:", e)
  }

  return response
}
