import { NextResponse } from "next/server"
import { createAdminClient } from "@/db/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Limpieza de destacados caducados. El listado ya ignora los caducados al leer
 * (lib/featured.ts), así que esto solo mantiene la columna `featured` coherente.
 * Protegido con CRON_SECRET (Vercel Cron lo envía como Bearer automáticamente).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from("products")
    .update({ featured: false })
    .eq("featured", true)
    .or(`featured_until.lt.${nowIso},featured_until.is.null`)
    .select("id")

  if (error) {
    console.error("Error expirando destacados:", error)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
  return NextResponse.json({ expired: data?.length ?? 0 })
}
