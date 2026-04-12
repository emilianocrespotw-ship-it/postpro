-- PostPro - Setup inicial de Supabase
-- Ejecutar en el SQL Editor de Supabase

-- Tabla de usuarios
create table if not exists users (
  email text primary key,
  plan text default 'free',
  created_at timestamptz default now()
);

-- Tabla de uso mensual
create table if not exists usage (
  email text not null,
  month text not null,   -- '2026-04'
  count integer default 0,
  primary key (email, month)
);

-- Tabla de agencias (logos)
create table if not exists agencies (
  user_id text primary key,
  name text,
  logo_data text,        -- base64 data URL
  updated_at timestamptz default now()
);

-- Tabla de posts generados
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  rubro text not null,
  email text,
  main_field text,
  text_facebook text,
  text_instagram text,
  image_url text,
  created_at timestamptz default now()
);

-- Banco de fotos por vino (vinoteca)
-- Cada foto queda vinculada a user_id + marca + varietal
create table if not exists wine_photos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  marca text not null,         -- normalizado lowercase, ej: "zuccardi"
  varietal text not null,      -- normalizado lowercase, ej: "malbec"
  categoria text default '',   -- normalizado lowercase, ej: "gran_reserva"
  url text not null,           -- URL pública en Supabase Storage
  storage_path text not null,  -- path dentro del bucket
  created_at timestamptz default now()
);

-- Si ya creaste la tabla sin la columna categoria, agrégala así:
-- alter table wine_photos add column if not exists categoria text default '';

create index if not exists wine_photos_user_idx on wine_photos(user_id, marca, varietal, categoria);

alter table wine_photos enable row level security;
create policy "Service role only" on wine_photos for all using (true);

-- Storage bucket para fotos de vinos
-- IMPORTANTE: también crear el bucket manualmente en Supabase:
--   Storage → New bucket → "wine-photos" → Public: OFF
-- O ejecutar esto si tenés permisos de storage:
-- insert into storage.buckets (id, name, public) values ('wine-photos', 'wine-photos', false)
-- on conflict (id) do nothing;

-- Índices útiles
create index if not exists posts_email_idx on posts(email);
create index if not exists posts_rubro_idx on posts(rubro);
create index if not exists usage_email_idx on usage(email);

-- Row Level Security (opcional pero recomendado)
alter table users enable row level security;
alter table usage enable row level security;
alter table agencies enable row level security;
alter table posts enable row level security;

-- Políticas: solo service_role puede leer/escribir (el backend usa service role key)
create policy "Service role only" on users for all using (true);
create policy "Service role only" on usage for all using (true);
create policy "Service role only" on agencies for all using (true);
create policy "Service role only" on posts for all using (true);
