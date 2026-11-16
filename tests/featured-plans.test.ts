import { test } from "node:test"
import assert from "node:assert/strict"

import {
  BASE_PRICE_CENTS,
  FEATURED_PLANS,
  TRIAL_DAYS,
  formatPrice,
  getPlan,
} from "../lib/featured-plans.ts"

test("el precio base del proyecto es 99 € y ningún plan lo baja", () => {
  assert.equal(BASE_PRICE_CENTS, 9900)
  for (const plan of FEATURED_PLANS) {
    assert.ok(plan.amountCents >= BASE_PRICE_CENTS, plan.id)
  }
  assert.ok(FEATURED_PLANS.some((p) => p.amountCents === 9900))
})

test("hay pago único (por días/semanas) y suscripción recurrente", () => {
  assert.ok(FEATURED_PLANS.some((p) => p.kind === "one_time"))
  assert.ok(FEATURED_PLANS.some((p) => p.kind === "subscription"))
  for (const plan of FEATURED_PLANS) {
    if (plan.kind === "one_time") assert.ok((plan.days ?? 0) > 0, plan.id)
    else assert.equal(plan.interval, "month", plan.id)
  }
})

test("ids únicos y getPlan", () => {
  const ids = FEATURED_PLANS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(getPlan("14d")?.amountCents, 9900)
  assert.equal(getPlan("no-existe"), undefined)
})

test("prueba gratuita de 7 días y formato de precio", () => {
  assert.equal(TRIAL_DAYS, 7)
  assert.ok(formatPrice(9900).includes("99"))
})
