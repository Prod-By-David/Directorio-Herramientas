// app/admin/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Server Action para Aprobar herramienta
async function handleApprove(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const cookieStore = await cookies() // <- Corregido: async/await obligatorio en Next.js
  
  const sbAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  await sbAdmin.from('products').update({ approved: true }).eq('id', id)
  revalidatePath('/admin')
}

// Server Action para Rechazar/Eliminar herramienta
async function handleDelete(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const cookieStore = await cookies() // <- Corregido: async/await obligatorio en Next.js
  
  const sbAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  await sbAdmin.from('products').delete().eq('id', id)
  revalidatePath('/admin')
}

export default async function AdminDashboard() {
  const cookieStore = await cookies() // <- Corregido: async/await obligatorio en Next.js
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Consultar herramientas pendientes de moderación
  const { data: pendingProducts, error } = await supabase
    .from('products')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error al cargar productos pendientes:', error.message)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-8 text-neutral-900 dark:text-white">
        Panel de Administración y Moderación
      </h1>
      
      {!pendingProducts || pendingProducts.length === 0 ? (
        <p className="text-neutral-500">No hay herramientas pendientes de revisión.</p>
      ) : (
        <div className="space-y-4">
          {pendingProducts.map((product) => (
            <div 
              key={product.id} 
              className="p-6 bg-white dark:bg-neutral-900 border rounded-xl flex items-center justify-between shadow-sm"
            >
              <div>
                <h3 className="text-xl font-bold">{product.codename}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{product.punchline}</p>
                <a 
                  href={product.product_website} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                >
                  {product.product_website}
                </a>
              </div>
              <div className="flex gap-3">
                <form action={handleApprove}>
                  <input type="hidden" name="id" value={product.id} />
                  <button 
                    type="submit" 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Aprobar
                  </button>
                </form>
                <form action={handleDelete}>
                  <input type="hidden" name="id" value={product.id} />
                  <button 
                    type="submit" 
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}