// Referencias literales a process.env.NEXT_PUBLIC_*: así Next las incluye también en el navegador.

// Quita espacios y comillas sobrantes (frecuentes al pegar valores en .env o en Codespaces secrets)
const clean = (value?: string) =>
  (value ?? "").trim().replace(/^["']+|["']+$/g, "")

/** null si todo está bien; si no, un texto explicando qué corregir. */
export function getSupabaseEnvProblem(): string | null {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean)
  if (missing.length) return `Faltan estas variables: ${missing.join(" y ")}.`

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocolo")
    }
  } catch {
    return `NEXT_PUBLIC_SUPABASE_URL no es una URL válida (el valor recibido empieza por "${url.slice(0, 14)}…"). Debe tener la forma https://<id-del-proyecto>.supabase.co, con https:// delante.`
  }
  return null
}

export const isSupabaseConfigured = () => getSupabaseEnvProblem() === null

export function getSupabaseEnv() {
  const problem = getSupabaseEnvProblem()
  if (problem) {
    throw new Error(
      `${problem} Revisa .env.local (copia de .env.example; valores en Supabase → Project Settings → API) y reinicia \`pnpm dev\`.`
    )
  }
  return {
    url: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}
