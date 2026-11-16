import { NextResponse } from "next/server"
import { createClient } from "@/db/supabase/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const rawNext = requestUrl.searchParams.get("next")
  // Solo rutas internas ("/algo"); se descartan "//host" y "@host" (open redirect)
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : null

  if (code) {
    // Añadimos await ya que createClient() ahora es asíncrono en el servidor
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (next) {
    return NextResponse.redirect(requestUrl.origin + next)
  } else {
    return NextResponse.redirect(requestUrl.origin)
  }
}