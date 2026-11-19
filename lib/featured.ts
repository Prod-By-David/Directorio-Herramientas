export type FeaturedFields = {
  featured?: boolean | null
  featured_until?: string | null
}

/** Un destacado solo cuenta si el flag está activo Y no ha caducado (no depende del cron). */
export function isFeaturedActive(p: FeaturedFields, now: number = Date.now()) {
  return (
    !!p.featured &&
    !!p.featured_until &&
    new Date(p.featured_until).getTime() > now
  )
}

/** Ranking: destacados vigentes primero (los que caducan más tarde antes), luego los más recientes. */
export function sortByRanking<T extends FeaturedFields & { created_at: string }>(
  items: T[]
): T[] {
  const now = Date.now()
  return [...items].sort((a, b) => {
    const fa = isFeaturedActive(a, now)
    const fb = isFeaturedActive(b, now)
    if (fa !== fb) return fa ? -1 : 1
    if (fa && fb) {
      const diff =
        new Date(b.featured_until!).getTime() -
        new Date(a.featured_until!).getTime()
      if (diff !== 0) return diff
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    timeZone: "UTC", // mismo resultado en servidor y navegador (evita desajustes de hidratación)
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
