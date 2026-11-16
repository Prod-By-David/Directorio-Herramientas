-- ============================================================================
-- Destacados con caducidad + seguridad (moderación, RLS, storage, privacidad)
-- Ejecutar DESPUÉS de las migraciones anteriores. Probar primero en un proyecto
-- Supabase de pruebas.
-- ============================================================================

-- 1) Columnas nuevas ---------------------------------------------------------
alter table public.products
  add column if not exists featured_until timestamptz,
  add column if not exists trial_used boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

create index if not exists idx_products_featured_until
  on public.products (featured_until) where featured;
create index if not exists idx_products_approved_created
  on public.products (approved, created_at desc);

-- 2) RLS de products ---------------------------------------------------------
drop policy if exists "Public can view products" on public.products;
drop policy if exists "Can view own products" on public.products;
drop policy if exists "Can insert own products" on public.products;
drop policy if exists "Can update own products" on public.products;
drop policy if exists "Can delete own products" on public.products;

-- Público: solo aprobados. Dueño: también los suyos pendientes.
create policy "View approved or own products" on public.products
  for select to anon, authenticated
  using (approved = true or auth.uid() = user_id);

-- Un usuario solo puede crear productos PENDIENTES y sin destacado.
create policy "Insert own pending products" on public.products
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and approved = false
    and featured = false
    and featured_until is null
    and trial_used = false
    and coalesce(view_count, 0) = 0
    and stripe_customer_id is null
    and stripe_subscription_id is null
    and rejected_at is null
    and rejection_reason is null
  );

create policy "Update own products" on public.products
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own products" on public.products
  for delete to authenticated
  using (auth.uid() = user_id);

-- Las columnas de moderación/destacado/Stripe solo las toca el servidor
-- (service_role) o el panel SQL; nunca anon/authenticated desde la API.
create or replace function public.protect_product_admin_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.user_id is distinct from old.user_id
       or new.approved is distinct from old.approved
       or new.featured is distinct from old.featured
       or new.featured_until is distinct from old.featured_until
       or new.trial_used is distinct from old.trial_used
       or new.view_count is distinct from old.view_count
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.rejected_at is distinct from old.rejected_at
       or new.rejection_reason is distinct from old.rejection_reason
    then
      raise exception 'No autorizado: estas columnas solo las modifica el servidor'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_product_admin_columns on public.products;
create trigger trg_protect_product_admin_columns
  before update on public.products
  for each row execute function public.protect_product_admin_columns();

-- 3) Privacidad: email, nombre, user_id y datos de Stripe NO legibles con la anon key.
--    (Cualquier columna futura que deba ser pública hay que añadirla a este GRANT.)
revoke select on public.products from anon, authenticated;
grant select (
  id, created_at, twitter_handle, product_website, codename, punchline,
  description, logo_src, tags, labels, categories, view_count, approved,
  featured, featured_until
) on public.products to anon, authenticated;

-- 4) Taxonomías y vistas ------------------------------------------------------
alter table public.categories enable row level security;
alter table public.labels enable row level security;
alter table public.tags enable row level security;
alter table public.product_views enable row level security;

drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can read labels" on public.labels;
drop policy if exists "Public can read tags" on public.tags;
create policy "Public can read categories" on public.categories
  for select to anon, authenticated using (true);
create policy "Public can read labels" on public.labels
  for select to anon, authenticated using (true);
create policy "Public can read tags" on public.tags
  for select to anon, authenticated using (true);
-- Sin políticas de escritura: solo service_role (servidor) inserta.

insert into public.categories (name) values
  ('ai-tools'), ('ai-agents'), ('ai-content'), ('boilerplate'), ('analytics'),
  ('marketing-tools'), ('developer-tools'), ('e-commerce'), ('productivity'),
  ('design-tools'), ('fintech'), ('education'), ('saas')
on conflict (name) do nothing;

-- 5) Contador de visitas: la migración anterior lo dejó solo para "postgres".
create or replace function public.increment_product_view_count(product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set view_count = coalesce(view_count, 0) + 1
   where id = product_id and approved = true;
end;
$$;

revoke all on function public.increment_product_view_count(uuid) from public;
grant execute on function public.increment_product_view_count(uuid)
  to anon, authenticated, service_role;

-- 6) Idempotencia del webhook de Stripe ---------------------------------------
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security; -- sin políticas: solo service_role

-- 7) Storage: cada usuario solo escribe en su carpeta (<user_id>/archivo) --------
drop policy if exists "select product product-logos" on storage.objects;
drop policy if exists "insert product product-logos" on storage.objects;
drop policy if exists "update product product-logos" on storage.objects;
drop policy if exists "delete product product-logos" on storage.objects;
drop policy if exists "insert own product-logos" on storage.objects;
drop policy if exists "update own product-logos" on storage.objects;
drop policy if exists "delete own product-logos" on storage.objects;

create policy "insert own product-logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-logos'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own product-logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-logos'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'product-logos'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own product-logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-logos'
         and (storage.foldername(name))[1] = auth.uid()::text);
-- "public read product-logos" (migración anterior) se mantiene: el bucket es público.
