-- ============================================================
-- Migration 001 — Schema inicial do sistema de tracking
-- Rodar no SQL Editor do Supabase (ou via supabase db push).
-- ============================================================

-- Extensões -------------------------------------------------
-- pgcrypto fica no schema "extensions" no Supabase.
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Funções de criptografia de segredos (pgcrypto)
-- A chave (ENCRYPTION_KEY) é passada pelo servidor; nunca fica no banco.
-- SECURITY DEFINER + REVOKE garante que anon/authenticated não executem.
-- ============================================================
create or replace function public.encrypt_secret(plaintext text, enc_key text)
returns text
language sql
security definer
set search_path = extensions, public
as $$
  select case
    when plaintext is null or plaintext = '' then null
    else encode(pgp_sym_encrypt(plaintext, enc_key), 'base64')
  end;
$$;

create or replace function public.decrypt_secret(ciphertext text, enc_key text)
returns text
language sql
security definer
set search_path = extensions, public
as $$
  select case
    when ciphertext is null or ciphertext = '' then null
    else pgp_sym_decrypt(decode(ciphertext, 'base64'), enc_key)
  end;
$$;

revoke all on function public.encrypt_secret(text, text) from public, anon, authenticated;
revoke all on function public.decrypt_secret(text, text) from public, anon, authenticated;
grant execute on function public.encrypt_secret(text, text) to service_role;
grant execute on function public.decrypt_secret(text, text) to service_role;

-- ============================================================
-- Trigger util: manter updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- settings (1 linha por usuário dono do painel)
-- ============================================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  webhook_token text,
  currency text not null default 'BRL',
  test_event_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ga4_accounts (N por usuário)
-- ============================================================
create table if not exists public.ga4_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  measurement_id text not null,
  api_secret_enc text,          -- cifrado (base64 do pgp_sym_encrypt)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- meta_pixels (N por usuário)
-- ============================================================
create table if not exists public.meta_pixels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  pixel_id text not null,
  capi_token_enc text,          -- cifrado
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- meta_ad_accounts (N por usuário)
-- ============================================================
create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  ad_account_id text not null,
  ads_token_enc text,           -- cifrado
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- visitors
-- ============================================================
create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trck_user_id text not null unique,
  email text,
  email_hash text,
  phone text,
  phone_hash text,
  name_hash text,
  fbp text,
  fbc text,
  ga_client_id text,
  ga_session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  ip text,
  user_agent text,
  geo jsonb,
  pixel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- events_log
-- ============================================================
create table if not exists public.events_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trck_user_id text,
  event_name text not null,
  event_id text not null unique,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  payload_meta jsonb,
  response_meta jsonb,
  payload_ga4 jsonb,
  response_ga4 jsonb,
  ip text,
  geo jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- purchases
-- ============================================================
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null unique,
  trck_user_id text,
  email text,
  email_hash text,
  phone text,
  phone_hash text,
  produto text,
  valor numeric(12,2),
  moeda text not null default 'BRL',
  status text,
  payment_method text,
  installments int,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  fbp text,
  fbc text,
  geo jsonb,
  match_type text,              -- como vinculou o visitante (trck_user_id | email | phone | none)
  meta_event_id text,
  response_meta jsonb,
  ga_client_id text,
  response_ga4 jsonb,
  conversion_sent boolean not null default false,  -- já disparou Purchase?
  webhook_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Índices
-- ============================================================
create index if not exists idx_visitors_user on public.visitors(user_id);
create index if not exists idx_visitors_trck on public.visitors(trck_user_id);
create index if not exists idx_visitors_email_hash on public.visitors(email_hash);
create index if not exists idx_visitors_phone_hash on public.visitors(phone_hash);
create index if not exists idx_events_user_name_created on public.events_log(user_id, event_name, created_at desc);
create index if not exists idx_events_trck on public.events_log(trck_user_id);
create index if not exists idx_events_created on public.events_log(created_at);
create index if not exists idx_purchases_user_created on public.purchases(user_id, created_at desc);
create index if not exists idx_purchases_trck on public.purchases(trck_user_id);
create index if not exists idx_ga4_user on public.ga4_accounts(user_id);
create index if not exists idx_pixels_user on public.meta_pixels(user_id);
create index if not exists idx_adaccts_user on public.meta_ad_accounts(user_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================
drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_visitors_updated on public.visitors;
create trigger trg_visitors_updated before update on public.visitors
  for each row execute function public.set_updated_at();

drop trigger if exists trg_purchases_updated on public.purchases;
create trigger trg_purchases_updated before update on public.purchases
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: ativar em todas as tabelas
-- Leitura: só o dono autenticado (auth.uid() = user_id).
-- Escrita: nenhuma policy → só service_role (que faz bypass de RLS).
-- ============================================================
alter table public.settings         enable row level security;
alter table public.ga4_accounts      enable row level security;
alter table public.meta_pixels       enable row level security;
alter table public.meta_ad_accounts  enable row level security;
alter table public.visitors          enable row level security;
alter table public.events_log        enable row level security;
alter table public.purchases         enable row level security;

drop policy if exists "read own settings" on public.settings;
create policy "read own settings" on public.settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own ga4" on public.ga4_accounts;
create policy "read own ga4" on public.ga4_accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own pixels" on public.meta_pixels;
create policy "read own pixels" on public.meta_pixels
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own adaccts" on public.meta_ad_accounts;
create policy "read own adaccts" on public.meta_ad_accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own visitors" on public.visitors;
create policy "read own visitors" on public.visitors
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own events" on public.events_log;
create policy "read own events" on public.events_log
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "read own purchases" on public.purchases;
create policy "read own purchases" on public.purchases
  for select to authenticated using (auth.uid() = user_id);

-- NOTA: segredos (*_enc) nunca devem ser lidos pelo browser.
-- As policies acima expõem a linha inteira ao dono; o painel deve
-- selecionar apenas colunas não-sensíveis. A descriptografia só
-- acontece no servidor via decrypt_secret() com service_role.
