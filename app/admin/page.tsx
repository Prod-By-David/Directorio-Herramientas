import Link from "next/link"
import type { ReactNode } from "react"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/db/supabase/admin"
import { formatDate, isFeaturedActive } from "@/lib/featured"
import { requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AdminProduct = {
  id: string
  created_at: string
  codename: string
  punchline: string
  product_website: string
  email: string
  full_name: string
  approved: boolean
  featured: boolean
  featured_until: string | null
  trial_used: boolean
  stripe_subscription_id: string | null
  rejected_at: string | null
  rejection_reason: string | null
}

const COLUMNS =
  "id, created_at, codename, punchline, product_website, email, full_name, approved, featured, featured_until, trial_used, stripe_subscription_id, rejected_at, rejection_reason"

function refresh() {
  revalidatePath("/admin")
  revalidatePath("/")
  revalidatePath("/products")
}

// Todas las acciones comprueban admin en el SERVIDOR (no basta con ocultar botones)
async function runUpdate(formData: FormData, values: Record<string, unknown>) {
  await requireAdmin()
  const id = String(formData.get("id") ?? "")
  if (!UUID_RE.test(id)) throw new Error("Id no válido")
  const { error } = await createAdminClient()
    .from("products")
    .update(values)
    .eq("id", id)
  if (error) throw new Error(`No se pudo actualizar: ${error.message}`)
  refresh()
}

async function approveTool(formData: FormData) {
  "use server"
  await runUpdate(formData, {
    approved: true,
    rejected_at: null,
    rejection_reason: null,
  })
}

// Rechazar NO borra: queda registrado (con motivo) y se puede revertir
async function rejectTool(formData: FormData) {
  "use server"
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300)
  await runUpdate(formData, {
    approved: false,
    featured: false,
    featured_until: null,
    rejected_at: new Date().toISOString(),
    rejection_reason: reason || null,
  })
}

async function unfeatureTool(formData: FormData) {
  "use server"
  await runUpdate(formData, { featured: false, featured_until: null })
}

function Row({
  product,
  children,
}: {
  product: AdminProduct
  children?: ReactNode
}) {
  return (
    <div className="p-5 bg-white dark:bg-neutral-900 border rounded-xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between shadow-sm">
      <div className="min-w-0">
        <h3 className="text-xl font-bold">{product.codename}</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {product.punchline}
        </p>
        <a
          href={product.product_website}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-blue-500 hover:underline mt-1 inline-block break-all"
        >
          {product.product_website}
        </a>
        <p className="text-xs text-neutral-500 mt-1">
          {product.full_name} · {product.email} · enviada el{" "}
          {formatDate(product.created_at)}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  )
}

const btn =
  "text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"

export default async function AdminDashboard() {
  await requireAdmin()

  const { data, error } = await createAdminClient()
    .from("products")
    .select(COLUMNS)
    .order("created_at", { ascending: false })

  if (error) console.error("Error al cargar productos:", error.message)

  const all = (data ?? []) as unknown as AdminProduct[]
  const pending = all.filter((p) => !p.approved && !p.rejected_at)
  const rejected = all.filter((p) => !p.approved && p.rejected_at)
  const featured = all.filter((p) => p.approved && isFeaturedActive(p))

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
          Panel de administración y moderación
        </h1>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Volver al directorio
        </Link>
      </div>

      {/* PENDIENTES */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Pendientes de revisión ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-neutral-500">No hay herramientas pendientes de revisión.</p>
        ) : (
          pending.map((product) => (
            <Row key={product.id} product={product}>
              <form action={approveTool}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className={`${btn} bg-green-600 hover:bg-green-700`}>
                  Aprobar
                </button>
              </form>
              <form action={rejectTool} className="flex gap-2">
                <input type="hidden" name="id" value={product.id} />
                <input
                  name="reason"
                  maxLength={300}
                  placeholder="Motivo (opcional)"
                  className="border rounded-lg px-3 py-2 text-sm bg-transparent"
                />
                <button type="submit" className={`${btn} bg-red-600 hover:bg-red-700`}>
                  Rechazar
                </button>
              </form>
            </Row>
          ))
        )}
      </section>

      {/* DESTACADAS VIGENTES: sirve para validar que el pago activó el destacado */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Destacadas vigentes ({featured.length})</h2>
        {featured.length === 0 ? (
          <p className="text-neutral-500">No hay herramientas destacadas ahora mismo.</p>
        ) : (
          featured.map((product) => (
            <Row key={product.id} product={product}>
              <span className="text-sm">
                Hasta <strong>{formatDate(product.featured_until!)}</strong>
                {product.stripe_subscription_id ? " · suscripción" : ""}
              </span>
              <form action={unfeatureTool}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className={`${btn} bg-neutral-700 hover:bg-neutral-800`}>
                  Quitar destacado
                </button>
              </form>
            </Row>
          ))
        )}
      </section>

      {/* RECHAZADAS */}
      {rejected.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Rechazadas ({rejected.length})</h2>
          {rejected.map((product) => (
            <Row key={product.id} product={product}>
              <span className="text-sm text-neutral-500">
                {product.rejection_reason ?? "Sin motivo indicado"}
              </span>
              <form action={approveTool}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className={`${btn} bg-green-600 hover:bg-green-700`}>
                  Aprobar de todos modos
                </button>
              </form>
            </Row>
          ))}
        </section>
      )}
    </div>
  )
}
