## Guía de Despliegue en Producción

Este directorio es totalmente portátil y agnóstico al dominio. Para ponerlo en marcha en tu propio entorno de producción:

1. **Variables de Entorno**:
   Renombra `.env.example` a `.env.local` (o configura las variables en tu proveedor de hosting como Vercel) con tus propias claves de **Supabase** y **Stripe**.

2. **Base de Datos (Supabase)**:
   Accede al **SQL Editor** de tu proyecto en Supabase y ejecuta los scripts ubicados en `supabase/migrations/` en orden cronológico para generar las tablas, índices, buckets de almacenamiento y políticas de seguridad.

3. **Configuración del Webhook de Stripe**:
   En tu panel de control de Stripe (Desarrolladores > Webhooks), crea un nuevo endpoint apuntando a tu dominio real:
   `https://TU-DOMINIO.com/api/webhooks/stripe`
   - Selecciona el evento: `checkout.session.completed`
   - Copia el *Signing Secret* (`whsec_...`) generado y guárdalo en tu variable `STRIPE_WEBHOOK_SECRET`.