-- Datos de DEMOSTRACIÓN (opcional, solo para pruebas). No son herramientas reales.
-- Requisito: haberte registrado al menos una vez en la web (se usa ese usuario como autor).
-- Ejecutar en el SQL Editor de Supabase (con rol postgres, que puede saltarse la RLS).

insert into public.products
  (full_name, email, twitter_handle, product_website, codename, punchline,
   description, logo_src, categories, user_id, approved, tags, labels)
select
  'Demo', 'demo@example.com', '@demo', 'https://example.com', d.codename, d.punchline,
  d.description, '/placeholder.png', d.category,
  (select id from auth.users order by created_at limit 1),
  true, '{}'::text[], '{unlabeled}'::text[]
from (values
  ('DemoWriter',  'Redacta textos con IA',        'Herramienta de demostración de escritura asistida por IA.', 'ai-content'),
  ('DemoAgent',   'Agentes que trabajan por ti',  'Herramienta de demostración de agentes de IA.',            'ai-agents'),
  ('DemoMetrics', 'Analítica sin complicaciones', 'Herramienta de demostración de analítica web.',            'analytics'),
  ('DemoPay',     'Cobros en minutos',            'Herramienta de demostración de pagos para SaaS.',          'fintech'),
  ('DemoDesign',  'Diseña sin diseñador',         'Herramienta de demostración de diseño.',                   'design-tools'),
  ('DemoLaunch',  'Plantilla para lanzar tu SaaS','Boilerplate de demostración para startups.',               'boilerplate')
) as d(codename, punchline, description, category)
where exists (select 1 from auth.users)
on conflict (codename) do nothing;
