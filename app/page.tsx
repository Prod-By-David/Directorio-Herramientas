import { Suspense } from "react"

import { FadeIn } from "@/components/cult/fade-in"
import { DirectorySearch } from "@/components/directory-search"
import { Hero } from "@/components/hero"
import { getIsAdmin } from "@/lib/admin"
import { isFeaturedActive } from "@/lib/featured"

import {
  EmptyFeaturedGrid,
  FeaturedGrid,
  ResourceCardGrid,
} from "../components/directory-card-grid"
import { NavSidebar } from "../components/nav"
import { getCachedFilters } from "./actions/cached_actions"
import { getProducts } from "./actions/product"

export const dynamic = "force-dynamic"

async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const [data, filters, isAdmin] = await Promise.all([
    getProducts(search),
    getCachedFilters(),
    getIsAdmin(),
  ])
  // Destacados = los marcados por el webhook (pago o prueba) que no han caducado
  const featuredData = data.filter((d) => isFeaturedActive(d))

  return (
    <>
      <NavSidebar
        categories={filters.categories}
        labels={filters.labels}
        tags={filters.tags}
        isAdmin={isAdmin}
      />

      <div className="max-w-full px-2 md:pl-4 md:pr-0 pt-2">
        <FadeIn>
          <ResourceCardGrid
            sortedData={data}
            filteredFeaturedData={featuredData}
          >
            <div className="grid grid-cols-1  xl:grid-cols-6 lg:gap-16 pb-8 pt-8 relative">
              <div className="col-span-1 md:col-span-2 z-10">
                <Hero>
                  <DirectorySearch />
                </Hero>
              </div>

              <div className="col-span-1 md:col-span-4 mt-6 md:mt-0">
                {featuredData.length >= 1 ? (
                  <Suspense fallback={<div>Cargando...</div>}>
                    <div className=" relative">
                      <FeaturedGrid featuredData={featuredData} />
                    </div>
                  </Suspense>
                ) : (
                  <div className="relative">
                    <EmptyFeaturedGrid />
                  </div>
                )}
              </div>
            </div>
          </ResourceCardGrid>
        </FadeIn>
      </div>
    </>
  )
}

export default Page
