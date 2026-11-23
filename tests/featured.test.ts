import { test } from "node:test"
import assert from "node:assert/strict"

import { daysLeft, isFeaturedActive, sortByRanking } from "../lib/featured.ts"

const NOW = Date.parse("2026-11-16T12:00:00Z")
const day = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

test("isFeaturedActive: solo cuenta si el flag está activo y no ha caducado", () => {
  assert.equal(isFeaturedActive({ featured: false, featured_until: iso(NOW + day) }, NOW), false)
  assert.equal(isFeaturedActive({ featured: true, featured_until: null }, NOW), false)
  assert.equal(isFeaturedActive({ featured: true, featured_until: iso(NOW - 1000) }, NOW), false)
  assert.equal(isFeaturedActive({ featured: true, featured_until: iso(NOW + day) }, NOW), true)
  assert.equal(isFeaturedActive({}, NOW), false)
})

test("sortByRanking: destacados vigentes primero; los caducados no cuentan", () => {
  // sortByRanking usa Date.now(): se generan fechas relativas a "ahora"
  const now = Date.now()
  const items = [
    { id: "normal-nueva", created_at: iso(now - day), featured: false, featured_until: null },
    { id: "caducada", created_at: iso(now - 3 * day), featured: true, featured_until: iso(now - 1000) },
    { id: "destacada-corta", created_at: iso(now - 5 * day), featured: true, featured_until: iso(now + 2 * day) },
    { id: "destacada-larga", created_at: iso(now - 9 * day), featured: true, featured_until: iso(now + 20 * day) },
    { id: "normal-vieja", created_at: iso(now - 30 * day), featured: false, featured_until: null },
  ]
  const order = sortByRanking(items).map((i) => i.id)
  assert.deepEqual(order, [
    "destacada-larga",
    "destacada-corta",
    "normal-nueva",
    "caducada",
    "normal-vieja",
  ])
})

test("sortByRanking no modifica el array original", () => {
  const now = Date.now()
  const items = [
    { created_at: iso(now - 2 * day), featured: false, featured_until: null },
    { created_at: iso(now - day), featured: false, featured_until: null },
  ]
  const copy = [...items]
  sortByRanking(items)
  assert.deepEqual(items, copy)
})

test("daysLeft: días enteros hacia arriba, 0 si ya caducó o no hay fecha", () => {
  assert.equal(daysLeft(iso(NOW + 14 * day), NOW), 14)
  assert.equal(daysLeft(iso(NOW + 14 * day - 1000), NOW), 14) // quedan 13 días y 23 h 59 min
  assert.equal(daysLeft(iso(NOW + 1000), NOW), 1)
  assert.equal(daysLeft(iso(NOW - 1000), NOW), 0)
  assert.equal(daysLeft(null, NOW), 0)
  assert.equal(daysLeft(undefined, NOW), 0)
})
