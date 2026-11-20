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

## GitHub Codespaces (entorno de pruebas)

1. Guarda las variables como **Codespaces secrets** (GitHub → Settings → Codespaces → Secrets, asociadas a este
   repositorio; `.devcontainer/devcontainer.json` ya las sugiere) o créalas en `.env.local` dentro del Codespace.
   Si cambias secrets, reconstruye/reinicia el Codespace; si editas `.env.local`, reinicia `pnpm dev`.
2. Deja `NEXT_PUBLIC_SITE_URL` **vacía**: se detecta de la petición (`https://<codespace>-3000.app.github.dev`).
3. En Supabase → Authentication → URL Configuration, añade esa URL (con `/**`) a *Redirect URLs*.
4. `pnpm dev` y abre el puerto 3000 desde la pestaña **Puertos**. `next.config.js` ya permite los orígenes
   `*.app.github.dev` (sin ello, el login y el envío fallan con "Invalid Server Actions request").
5. Webhook en Codespaces: con la Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) no hace
   falta tocar la visibilidad del puerto. Con un endpoint creado en el panel de Stripe (modo test) hay que poner el
   puerto 3000 en **Público** y usar `https://<codespace>-3000.app.github.dev/api/webhooks/stripe`.

### Comprobaciones automáticas

| Comando | Qué hace |
|---|---|
| `pnpm verify` | Tests + chequeo de tipos + build |
| `pnpm check:env` | Revisa variables, modo prueba de Stripe, migración aplicada, bucket y que el email no sea público |
| `pnpm test:webhook` | Con el servidor en marcha, simula pagos firmados y comprueba activación, suma de días, idempotencia, firma inválida, eventos live ignorados y caducidad (crea y borra un producto temporal) |
| `pnpm test:security` | Crea 2 usuarios temporales y comprueba la RLS real: no pueden auto-aprobarse ni auto-destacarse, no ven pendientes ajenas, el email no es legible, el contador y el storage por carpeta funcionan (lo borra todo al terminar) |
| `pnpm test:stripe` | Sin servidor: valida la clave `sk_test_`, la cuenta de Stripe y que acepta crear sesiones de pago (pago único y suscripción). Si el pago falla en la web, el motivo real sale aquí |

## Problemas frecuentes

- **Indicador rojo "N · X Issues" en desarrollo** (React 19): pulsa el indicador para ver el detalle de cada uno. Los `Dialog` y
  `Sheet` de Radix necesitan `Title` (error) y `Description` (aviso); ya los tienen. Si reaparece "Accessing element.ref was removed
  in React 19", viene de versiones antiguas de Radix/framer-motion/sonner en el lockfile: sube sus mínimos en `package.json` y
  ejecuta `pnpm install`.
- **El pago no se inicia** ("the product tax code is missing"): las cuentas nuevas de Stripe traen *Managed Payments* activado por
  defecto, que exige un `tax_code` por producto. El checkout lo desactiva en cada sesión (`managed_payments: { enabled: false }`).
  El toast muestra el motivo real en modo prueba y `pnpm test:stripe` lo diagnostica sin la web.

- **"Your project's URL and Key are required to create a Supabase client"** (o pantalla "Falta configurar el
  entorno"): falta `.env.local` o las variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Copia `.env.example` a `.env.local`, rellénalas (Supabase → Project Settings → API) y **reinicia** `pnpm dev`
  (las variables solo se leen al arrancar).
- **"Encountered a script tag while rendering React component"**: lo causaba `next-themes` con React 19 y también
  aparece como efecto secundario cuando el servidor falla al renderizar (p. ej. por un error de Supabase): corrige
  primero ese error. El tema usa un proveedor propio (`app/providers.tsx`) y el script anti-parpadeo
  (`lib/theme-script.ts`) se inyecta como HTML en el layout, sin elemento `<script>` de React.
- **"Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"**: `NEXT_PUBLIC_SUPABASE_URL` no tiene la forma
  `https://<id-del-proyecto>.supabase.co` (falta `https://`, es solo el id, o se pegó otra cosa). `pnpm check:env`
  lo detecta.
- Al actualizar desde un zip anterior, extrae en una **carpeta nueva** (o borra la anterior): extraer encima deja
  archivos eliminados, como las capturas de la plantilla de `app/*-image.png`.

## Subir a GitHub

- El repositorio **no contiene secretos**: `.env*` está ignorado salvo `.env.example`.
- Crea el repositorio como **privado**: `LICENSE.md` es una licencia personal de NewCult (código base de la plantilla)
  que puede limitar su redistribución. Confirma con el responsable antes de hacerlo público.
- `.github/workflows/ci.yml` ejecuta tests, tipos y build con valores ficticios en modo prueba. Tras subir el
  `pnpm-lock.yaml` actualizado, cambia `--no-frozen-lockfile` por `--frozen-lockfile`.
- Nunca subas claves de Stripe/Supabase; en Vercel/GitHub se configuran como variables de entorno o secrets.

## Guía rápida paso a paso (Codespaces)

1. Edita `.env.local` (en la raíz del proyecto): `ADMIN_EMAILS` = tu email, `CRON_SECRET` = salida de `openssl rand -hex 32`,
   claves de Supabase y de Stripe **de pruebas**, `NEXT_PUBLIC_SITE_URL=""`.
2. Supabase (proyecto de pruebas): ejecuta en el SQL Editor **solo** `supabase/migrations/20261116120000_featured_security_fixes.sql`
   (es re-ejecutable; las migraciones anteriores ya aplicadas no se repiten). En Authentication → Email, desactiva *Confirm email*
   mientras pruebas.
3. `pnpm install` → `pnpm verify` (tests, tipos y build).
4. `pnpm dev`, abre el puerto 3000 y crea tu cuenta en `/login` con el email de `ADMIN_EMAILS`.
5. `pnpm check:env` (todo en OK) y, con el servidor en marcha, `pnpm test:webhook`.
6. En el navegador: envía una herramienta en `/submit` → apruébala en `/admin` → en su ficha, "Probar 7 días gratis".

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
