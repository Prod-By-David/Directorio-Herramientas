# Directorio de Herramientas (IA / software) — MODO PRUEBA

Directorio en **Next.js** (App Router, Tailwind + shadcn/ui) con **Supabase** y listados
**destacados de pago con Stripe** (precio base 99 €). Los destacados se activan y caducan
automáticamente.

> **Estado: MODO PRUEBA.** Solo se usan claves de pruebas de Stripe. El código rechaza claves
> `sk_live_` e ignora eventos reales mientras `ALLOW_LIVE_PAYMENTS` no sea `"true"`.
> Pasar a modo real lo decide el responsable cuando se vaya a vender (ver el final).

## Cómo funciona

1. Un usuario se registra y envía su herramienta (`/submit`). Queda **pendiente**.
2. Un admin (`ADMIN_EMAILS`) la aprueba o rechaza en `/admin`. Solo las aprobadas son públicas.
3. El dueño de una herramienta aprobada, en su ficha, puede:
   - **Probar 7 días gratis** (una vez por herramienta), o
   - **Pagar** un plan (2 semanas 99 €, 30 días, 90 días o suscripción mensual) con Stripe Checkout.
4. El webhook de Stripe (`/api/webhooks/stripe`) marca `featured = true` y fija `featured_until`.
5. El listado ordena primero los destacados **vigentes** (`featured` y `featured_until` futuro);
   al caducar dejan de contar aunque el cron no haya corrido. `/api/cron/expire-featured`
   (diario, `vercel.json`) solo mantiene la columna `featured` coherente.
6. En `/admin` aparece la lista de **destacadas vigentes** con su fecha de fin, para validar que el
   pago activó el destacado.

Los importes distintos de 99 € están en `lib/featured-plans.ts` y son **provisionales**.

## Puesta en marcha (modo prueba)

```bash
pnpm install            # actualiza pnpm-lock.yaml (los @types pasaron a React 19): súbelo al repo
cp .env.example .env.local
pnpm test               # tests unitarios (ranking de destacados y planes de precio)
```

1. **Supabase**: crea un proyecto de pruebas y ejecuta, en orden, los SQL de `supabase/migrations/`
   (el último es `20261116120000_featured_security_fixes.sql`). Rellena las 3 variables de Supabase.
2. **Stripe (modo test)**: copia `sk_test_…` y `pk_test_…` a `.env.local`. Para el webhook en local:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   y copia el `whsec_…` que imprime a `STRIPE_WEBHOOK_SECRET`.
3. (Opcional) `supabase/seed.sql` carga 6 herramientas de demostración (requiere haberte registrado antes).
4. `ADMIN_EMAILS="tu@email.com"` (el email debe estar confirmado en Supabase) y un `CRON_SECRET` largo.
5. `pnpm dev` y abre http://localhost:3000.

## Subir a GitHub

- El repositorio **no contiene secretos**: `.env*` está ignorado salvo `.env.example`.
- Crea el repositorio como **privado**: `LICENSE.md` es una licencia personal de NewCult (código base de la plantilla)
  que puede limitar su redistribución. Confirma con el responsable antes de hacerlo público.
- `.github/workflows/ci.yml` ejecuta tests, tipos y build con valores ficticios en modo prueba. Tras subir el
  `pnpm-lock.yaml` actualizado, cambia `--no-frozen-lockfile` por `--frozen-lockfile`.
- Nunca subas claves de Stripe/Supabase; en Vercel/GitHub se configuran como variables de entorno o secrets.

## Lista de pruebas (Fase 4)

Tarjeta de prueba de Stripe: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.

| Prueba | Cómo | Resultado esperado |
|---|---|---|
| Envío | Registrarse y enviar una herramienta en `/submit` | Queda pendiente; no aparece en `/` ni `/products` |
| Moderación | En `/admin`, aprobar | Aparece en el listado público |
| Rechazo | En `/admin`, rechazar con motivo | No es pública; queda en "Rechazadas" y se puede revertir |
| Pago único | En la ficha, plan "2 semanas" y pagar | Vuelve con aviso; `featured = true`, `featured_until` ≈ +14 días; sale primera y con la etiqueta "Destacada" |
| Acumulación | Pagar otro plan estando destacada | Los días se **suman** a lo que quedaba |
| Suscripción | Plan mensual y pagar | `stripe_subscription_id` rellenado; `featured_until` = fin de periodo |
| Cancelación | `stripe trigger customer.subscription.deleted` o cancelar en el panel de Stripe | Se retira el destacado |
| Caducidad | SQL: `update products set featured_until = now() - interval '1 minute' where id = '<id>';` y recargar `/` | Deja de aparecer destacada al instante |
| Cron | `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/expire-featured` | `{"expired": n}` y `featured = false` |
| Prueba gratuita | Botón "Probar 7 días gratis" | Destacada 7 días; el botón no vuelve a salir |
| Reintentos | Reenviar un evento desde Stripe | Respuesta `duplicate: true`; sin efectos dobles |
| Seguridad | Con un usuario normal, `update` de `approved`/`featured` con supabase-js | Error `42501` |
| Móvil | Revisar `/`, `/products`, la ficha y `/admin` en pantalla estrecha | Se ve correctamente |

## Pasar a modo real (solo cuando el responsable lo autorice)

1. Claves `sk_live_…`/`pk_live_…` y un endpoint de webhook live con su `whsec_…`.
2. `ALLOW_LIVE_PAYMENTS="true"`.
3. Revisar importes (`lib/featured-plans.ts`), `NEXT_PUBLIC_SITE_URL` y la licencia del código base (`LICENSE.md`).
