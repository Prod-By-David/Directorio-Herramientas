import { type NextRequest } from "next/server"
import { updateSession } from "@/db/supabase/middleware"

// Next 16: "middleware.ts" pasó a llamarse "proxy.ts" (misma función: refrescar la sesión de Supabase).
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto:
     * - _next/static y _next/image (archivos estáticos)
     * - favicon.ico
     * - imágenes .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
