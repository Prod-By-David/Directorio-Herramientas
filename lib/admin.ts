import "server-only"
import { redirect } from "next/navigation"
import { createClient } from "@/db/supabase/server"

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** Si ADMIN_EMAILS está vacía NADIE es admin (fallo cerrado). */
export function isAdminEmail(email?: string | null) {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

export async function getIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user && !!user.email_confirmed_at && isAdminEmail(user.email)
}

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")
  // Exigimos email confirmado para que nadie se registre con un email de admin ajeno.
  if (!user.email_confirmed_at || !isAdminEmail(user.email)) redirect("/")
  return user
}
