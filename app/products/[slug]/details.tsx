"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Blocks,
  Edit2Icon,
  ExternalLink,
  Hash,
  HeartIcon,
  MessageSquareTextIcon,
  Sparkles,
  Tag,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { startFeaturedTrial } from "@/app/actions/featured"
import { formatDate, isFeaturedActive } from "@/lib/featured"
import { FEATURED_PLANS, TRIAL_DAYS, formatPrice } from "@/lib/featured-plans"
import type { PublicProduct as Product } from "@/lib/types"

export const ProductDetails = ({
  product,
  canManageFeatured,
  trialAvailable,
  checkoutStatus,
}: {
  product: Product
  canManageFeatured: boolean
  trialAvailable: boolean
  checkoutStatus: "success" | "canceled" | null
}) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [isTrialPending, startTrial] = useTransition()
  const featuredActive = isFeaturedActive(product)
  const testMode = (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
  ).startsWith("pk_test_")

  // Pago con Stripe: el precio lo decide el servidor a partir del plan
  const handleCheckout = async (planId: string) => {
    try {
      setLoadingPlan(planId)
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, planId }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url // Redirige a Stripe Checkout
        return
      }
      toast.error(data.error || "No se pudo iniciar el pago")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error de conexión con la pasarela de pagos")
    }
    setLoadingPlan(null)
  }

  const handleTrial = () => {
    startTrial(async () => {
      const res = await startFeaturedTrial(product.id)
      if (res.ok) {
        toast.success(res.message)
        window.location.reload()
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className={cn("py-4 relative flex flex-col h-full")}>
      <div className="w-full gap-8 py-6 relative items-center">
        <div className="grid grid-cols-6 md:grid-cols-12 gap-8 w-full">
          <div className="space-y-6 col-span-6 md:col-span-5 md:mt-12 z-10">
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Herramientas</BreadcrumbLink>/
                <BreadcrumbLink href={`/products/${product.id}`}>
                  {product.codename.substring(0, 20)}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Breadcrumb>
            <CardTitle className="text-6xl tracking-tighter font-extrabold text-neutral-900 dark:text-neutral-200">
              {product.punchline}
            </CardTitle>
            <CardDescription className="md:text-xl text-lg tracking-tight text-neutral-800 text-balance dark:text-neutral-400 flex gap-2 items-center ">
              <Blocks className="stroke-1 size-8" />{" "}
              <span className="flex-wrap">{product.categories}</span>
            </CardDescription>
            {product.tags.length >= 1 && (
              <CardDescription className="md:text-xl text-lg tracking-tight text-neutral-800 text-balance dark:text-neutral-400 flex gap-2 items-center ">
                <Tag className="stroke-1 size-8" />{" "}
                <span className="flex-wrap">{product.tags.join(", ")}</span>
              </CardDescription>
            )}

            <Link
              href={`/products`}
              className="py-4 md:flex items-center text-2xl font-semibold text-yellow-500  z-10 hidden"
            >
              <ArrowLeft className="mr-2" /> Volver a todas las herramientas
            </Link>
          </div>

          <div
            className={cn(
              "w-full col-span-7 p-3 md:p-7 rounded-[36px] md:rounded-[58px] border border-black/10 space-y-10",
              "bg-white dark:bg-[#1E1E1E]  shadow-[0_0_0_1px_rgba(0,0,0,0.1)_inset,0_0.5px_0.5px_rgba(0,0,0,0.05)_inset,0_-0.5px_0.5px_rgba(0,0,0,0.05)_inset,0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.06)_inset,0_0.5px_0.5px_rgba(255,255,255,0.1)_inset,0_-0.5px_0.5px_rgba(255,255,255,0.1)_inset,0_0.5px_1px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.4)]"
            )}
          >
            <div className="w-full p-1 md:p-3 rounded-[28px] md:rounded-[36px] bg-[#3d3d3d]">
              <img
                className="w-full h-full rounded-3xl object-cover"
                src={product.logo_src}
                alt={product.codename}
              />
            </div>
            <CardDescription className="text-2xl tracking-tight leading-tight text-neutral-800 text-balance dark:text-neutral-400">
              {product.description}
            </CardDescription>

            <div className="md:text-xl sm:text-lg tracking-tight text-neutral-800 text-balance dark:text-neutral-400 flex gap-2 items-center flex-wrap text-sm">
              {product.labels.length > 0 &&
                product.labels[0] !== "unlabeled" &&
                product.labels.map((label, index) => (
                  <Link
                    href={`/products?label=${label}`}
                    key={index}
                    className="flex-wrap flex gap-1"
                  >
                    <Hash className="stroke-1 size-4" /> <span>{label}</span>
                  </Link>
                ))}
            </div>

            {!product.approved && (
              <p className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
                Esta herramienta está pendiente de aprobación y solo la ves tú.
              </p>
            )}
            {checkoutStatus === "success" && (
              <p className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
                Pago recibido. El destacado se activa en unos segundos; si no
                lo ves, recarga la página.
              </p>
            )}
            {checkoutStatus === "canceled" && (
              <p className="rounded-2xl border border-neutral-500/40 p-4 text-sm">
                Pago cancelado. No se ha realizado ningún cargo.
              </p>
            )}

            <div className="space-y-4 w-full">
              {product.product_website && (
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="w-full flex items-center justify-center py-6 text-lg rounded-[44px]"
                >
                  <a
                    href={product.product_website}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <span className="font-semibold">Visitar web</span>
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}

              {featuredActive && product.featured_until && (
                <p className="flex items-center justify-center gap-2 rounded-[44px] bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-white font-semibold">
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                  Destacada hasta el {formatDate(product.featured_until)}
                </p>
              )}

              {canManageFeatured && (
                <div className="space-y-3 rounded-3xl border border-black/10 dark:border-white/10 p-4">
                  <p className="font-bold text-lg">
                    {featuredActive ? "Ampliar destacado" : "Destacar herramienta"}
                  </p>
                  {testMode && (
                    <p className="text-xs text-muted-foreground">
                      Modo prueba: usa la tarjeta 4242 4242 4242 4242, cualquier
                      fecha futura y cualquier CVC. No se realizan cargos reales.
                    </p>
                  )}
                  {trialAvailable && (
                    <Button
                      onClick={handleTrial}
                      disabled={isTrialPending || loadingPlan !== null}
                      variant="outline"
                      size="lg"
                      className="w-full rounded-[44px]"
                    >
                      {isTrialPending ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-5 w-5" />
                      )}
                      Probar {TRIAL_DAYS} días gratis
                    </Button>
                  )}
                  {FEATURED_PLANS.map((plan) => (
                    <Button
                      key={plan.id}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={loadingPlan !== null || isTrialPending}
                      size="lg"
                      className="w-full flex items-center justify-between py-6 text-base rounded-[44px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                    >
                      <span className="flex items-center">
                        {loadingPlan === plan.id ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-5 w-5 text-yellow-300" />
                        )}
                        <span className="font-bold">{plan.label}</span>
                      </span>
                      <span className="font-bold">
                        {formatPrice(plan.amountCents)}
                        {plan.kind === "subscription" ? "/mes" : ""}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      <Link
        href={`/`}
        className="py-4 md:hidden items-center text-2xl font-semibold text-yellow-500  z-10 w-full flex"
      >
        <ArrowLeft className="mr-2" /> Volver a todas las herramientas
      </Link>
      <div className="absolute top-36 md:top-0 left-[-10%] right-0 h-[400px] w-[300px]  md:h-[500px] md:w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(255,235,59,.15),rgba(255,255,255,0))]"></div>
    </div>
  )
}