// Se muestra cuando faltan las variables de Supabase (p. ej. primer arranque tras clonar el repo).
export function SetupRequired() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Falta configurar el entorno
      </h1>
      <p className="text-muted-foreground">
        La aplicación necesita las claves de Supabase para arrancar. Sigue estos
        pasos (modo prueba):
      </p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Copia <code className="rounded bg-muted px-1">.env.example</code> a{" "}
          <code className="rounded bg-muted px-1">.env.local</code>.
        </li>
        <li>
          En Supabase → <em>Project Settings → API</em>, copia la URL y la clave{" "}
          <em>anon</em> en{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          y{" "}
          <code className="rounded bg-muted px-1">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>
          , y la clave <em>service_role</em> en{" "}
          <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code>.
        </li>
        <li>
          Ejecuta los SQL de <code className="rounded bg-muted px-1">supabase/migrations/</code>{" "}
          en orden en el SQL Editor de Supabase.
        </li>
        <li>
          Reinicia el servidor (<code className="rounded bg-muted px-1">pnpm dev</code>
          ): las variables solo se leen al arrancar.
        </li>
      </ol>
    </div>
  )
}
