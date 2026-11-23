import { notFound } from "next/navigation"
import { createClient } from "@/db/supabase/server"
import { daysLeft, isFeaturedActive } from "@/lib/featured"
import { getSubscriptionSummary } from "@/lib/subscription"

import { FadeIn } from "@/components/cult/fade-in"
import { getOwnerState, getProductById } from "@/app/actions/product"

import { ProductDetails } from "./details"

const ProductIdPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkout?: string }>
}) => {
  const { slug } = await params
  const { checkout } = await searchParams

  // getProductById devuelve un único objeto (antes se hacía data[0] y fallaba)
  const product = await getProductById(slug)
  if (!product) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const owner = user
    ? await getOwnerState(product.id, user.id)
    : { isOwner: false, trialUsed: false, stripeSubscriptionId: null }

  // Quién mira la ficha: sirve para explicar por qué se ven (o no) los controles de destacado
  const viewer: "anon" | "owner" | "other" = !user
    ? "anon"
    : owner.isOwner
      ? "owner"
      : "other"

  const canManageFeatured = owner.isOwner && product.approved
  const trialAvailable =
    canManageFeatured && !owner.trialUsed && !isFeaturedActive(product)

  // Estado real de la suscripción en Stripe (solo se consulta para el propietario)
  const subscription =
    owner.isOwner && owner.stripeSubscriptionId
      ? await getSubscriptionSummary(owner.stripeSubscriptionId)
      : null

  return (
    <div className="z-10">
      <div className=" py-4 w-full relative  mx-auto max-w-6xl">
        <FadeIn>
          <ProductDetails
            product={product}
            canManageFeatured={canManageFeatured}
            trialAvailable={trialAvailable}
            viewer={viewer}
            viewerEmail={user?.email ?? null}
            subscription={subscription}
            featuredDaysLeft={daysLeft(product.featured_until)}
            checkoutStatus={
              checkout === "success" || checkout === "canceled" ? checkout : null
            }
          />
        </FadeIn>
      </div>
    </div>
  )
}

export default ProductIdPage
