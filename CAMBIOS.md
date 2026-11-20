# Cambios respecto al zip original (modo prueba)

## Bloqueantes corregidos
- **Build**: `getAIEnrichmentPrompt` exportada; `await createClient()` / `await headers()` en envío y login; `params`/`searchParams` asíncronos (Next 16); scripts de `package.json` que apuntaban a `supabase/seed` (inexistente) eliminados; `@types/react*` a ^19 (ejecutar `pnpm install` para refrescar el lockfile).
- **Webhook ↔ BD**: ahora escribe `featured` + `featured_until` (columnas reales). Idempotente (`stripe_events`), exige pago confirmado, suma días a un destacado vigente y gestiona suscripciones (`invoice.paid`, `customer.subscription.deleted`).
- **Home**: eliminado `FEATURED_IDS`; los destacados salen de la BD. Anuncios de newcult.co sustituidos por una invitación a destacar.
- **Ficha de producto**: `getProductById` devuelve un objeto (antes se usaba `data[0]`).
- **Caducidad**: `featured_until` + filtro al leer + cron diario `/api/cron/expire-featured` (`vercel.json`).

## Moderación y seguridad
- Envíos siempre `approved: false`; la RLS y un trigger impiden que un usuario cambie `approved`, `featured`, etc.
- `SELECT` público solo de aprobados (el dueño ve los suyos); email, nombre, `user_id` y datos de Stripe dejan de ser legibles con la anon key (GRANT por columnas).
- Panel `/admin`: fallo cerrado sin `ADMIN_EMAILS`, email confirmado obligatorio, service role con cliente plano, rechazo reversible con motivo, lista de destacadas vigentes.
- Checkout: requiere sesión, producto propio y aprobado; el precio sale del plan en servidor.
- RLS en `categories`, `labels`, `tags`, `product_views`; storage por carpeta de usuario; contador de vistas reparado; open redirect del callback de auth corregido; solo URLs http(s) en el formulario.

## Requisitos del planteamiento añadidos
- Planes: 2 semanas (99 €), 30 días, 90 días y suscripción mensual (importes ≠ 99 € provisionales, en `lib/featured-plans.ts`).
- Prueba gratuita de 7 días (una vez por herramienta).
- Categorías de IA, interfaz principal en español, README con lista de pruebas de la Fase 4.

## Listo para GitHub
- `.gitignore` ahora ignora `.env` y `.env.*` (antes solo `*.local`); `.env.example` documentado.
- CI en `.github/workflows/ci.yml` (tests, tipos y build en modo prueba), `.nvmrc`, `engines`, nombre y descripción del paquete.
- Tests unitarios (`pnpm test`, 7 pasan): ranking de destacados, caducidad y planes de precio.
- `supabase/seed.sql` con datos de demostración opcionales.
- Clientes Supabase SSR migrados a `getAll/setAll`; cambio de contraseña con validación (antes no comprobaba la confirmación ni los errores); logo vacío y URL inválida ya no rompen el listado; interfaz traducida al español.

## Correcciones tras la primera ejecución
- Aviso de React 19 "script tag" (`ThemeProvider`): `next-themes` 0.3 renderizaba un `<script>` en el cliente. Sustituido por un proveedor de tema propio (`app/providers.tsx`); el script anti-parpadeo se inyecta desde el layout (servidor, `lib/theme-script.ts`). Dependencia eliminada también del `pnpm-lock.yaml`.
- Error "Your project's URL and Key are required": faltaba `.env.local` con las claves de Supabase. Ahora el layout muestra una pantalla de configuración y los clientes Supabase lanzan un error explicativo.
- Se eliminan los archivos de la plantilla que reaparecen al extraer el zip sobre una carpeta anterior (capturas Open Graph, anuncios, hook obsoleto).

## Codespaces y pruebas
- `next.config.js`: `serverActions.allowedOrigins` y `allowedDevOrigins` para `*.app.github.dev`.
- `.devcontainer/devcontainer.json` (Node 22, pnpm, puerto 3000, secrets sugeridos).
- `NEXT_PUBLIC_SITE_URL` ahora es opcional; el checkout usa `x-forwarded-host` si está vacía.
- Scripts: `pnpm verify`, `pnpm check:env` (entorno/migración/privacidad) y `pnpm test:webhook` (pagos simulados firmados, idempotencia, caducidad).

## Errores de tipos detectados en Codespaces (`pnpm verify`)
- `@/assets/placeholder.png` sin tipos: `global.d.ts` referencia los tipos de imagen de Next (no depende de `next-env.d.ts`, que está en `.gitignore`).
- `framer-motion` 11 no es compatible con los tipos de React 19 (`className` en `motion.div`/`motion.p`): la tarjeta usa elementos normales con una animación CSS (`.animate-card-in`).
- `isRedirectError` ya no existe en Next 16: se eliminó el código muerto (`lib/error.ts`, `hooks/use-upload-file.ts`, `components/cult/fallback-image.tsx`, sin usos).
- `pnpm doctor` ejecutaba el comando propio de pnpm: el script se renombró a `pnpm check:env`.
- Los tests ya no muestran el aviso `MODULE_TYPELESS_PACKAGE_JSON`.

## Segunda ronda en Codespaces
- El aviso "script tag" persistía en `app/layout.tsx`: el script de tema ya no es un elemento `<script>` de React; se inyecta como HTML (`innerHTML`) en el layout y lo ejecuta el navegador al parsear. El aviso también aparece como efecto secundario de un error de render del servidor.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL` se valida (con `https://`) y se limpian comillas/espacios; la pantalla de configuración y `pnpm check:env` indican el problema concreto.

## Revisión profunda (todo el código)
- `middleware.ts` -> `proxy.ts` (convención de Next 16).
- Migración: `user_id` queda legible con la anon key (UUID opaco) para que la política del dueño no dependa de privilegios de columna; email y nombre siguen ocultos.
- Tarjeta: `useOptimistic` ahora se actualiza dentro de una transición (evita el aviso de React).
- Menú: enlaces de categoría/tag/etiqueta codificados (`encodeURIComponent`), refresco al cerrar sesión, textos en español.
- Búsqueda: se sanean también las comillas dobles del filtro de PostgREST.
- Login: `id`/`autocomplete` correctos en los campos (accesibilidad y gestores de contraseñas).
- Scripts: `check:env` y `test:webhook` compatibles con las claves nuevas de Supabase (`sb_publishable_`/`sb_secret_`); `TEST_USER_ID` opcional.

## Modo prueba
- `lib/stripe.ts` rechaza `sk_live_` y el webhook ignora eventos live salvo `ALLOW_LIVE_PAYMENTS="true"`.

## Pendiente / no verificado
- No se pudo ejecutar `pnpm install`, `next build`, el chequeo de tipos ni la migración (sin red ni Postgres): se comprobó la sintaxis de todos los TS/TSX y se ejecutaron los tests unitarios.
- Imagen Open Graph propia (se eliminaron las capturas de la plantilla).
- Licencia de NewCult (`LICENSE.md`): confirmar con el responsable.

## Nota sobre la migración
- `20261116120000_featured_security_fixes.sql` es re-ejecutable (todas las políticas se borran antes de crearse). Las migraciones anteriores no se modifican ni se vuelven a ejecutar.

## Node 22.16 en Codespaces
- `engines` pasa a `>=20.9` (requisito real de Next 16) y `pnpm test` usa `--experimental-strip-types`, necesario en Node 22.6-22.17 (en 22.18+ es el comportamiento por defecto).

## Verificado en Codespaces
- `pnpm verify` (tests + tipos + build de Next 16), `pnpm check:env` (11/11) y `pnpm test:webhook` (9/9) pasan.
- Nuevo `pnpm test:security`: prueba la seguridad de la migración con usuarios reales temporales.

## Issues de desarrollo y pagos
- Pago que no se iniciaba: Stripe tiene *Managed Payments* activado por defecto en la cuenta y exigía `tax_code` ("the product tax code is missing"). El checkout y `pnpm test:stripe` pasan `managed_payments: { enabled: false }`. Si más adelante se quiere Managed Payments, habrá que asignar un `tax_code` a cada producto.
- Indicador "Issues": `Sheet` del menú móvil y `Dialog` de cambio de contraseña con `Title`/`Description`; `formatDate` en UTC (sin desajustes de hidratación). Tras ello el indicador desapareció en Codespaces.
- Checkout: origen tolerante a cabeceras `x-forwarded-*` en lista, `locale: "es"`, y en modo prueba el error real de Stripe llega al toast y a la terminal.
- Nuevo `pnpm test:stripe` (clave, cuenta y sesiones de pago de prueba, sin servidor).
- Dependencias (Radix, framer-motion…): sin cambios; solo habría que subirlas si reaparecen avisos de `element.ref`.

## Stripe CLI
- Las versiones recientes de `stripe listen` exigen `--events` (o `--all-snapshot`). Los eventos que gestiona el webhook son: `checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,customer.subscription.deleted`.

## Controles de destacado en la ficha
- Los planes de pago solo los ve el propietario (con sesión iniciada y herramienta aprobada). Si no se ven, la ficha ahora explica por qué: sin sesión, o sesión con otra cuenta (muestra el email).

## Webhook 400 y Issues de Radix
- Webhook: `STRIPE_WEBHOOK_SECRET` (y las claves de Stripe) se limpian de espacios, saltos de línea y comillas; `pnpm check:env` avisa si un valor contiene espacios.
- Issues "element.ref": `package.json` sube `@radix-ui/*` y `cmdk` (versiones compatibles con React 19). Requiere `pnpm install`.
