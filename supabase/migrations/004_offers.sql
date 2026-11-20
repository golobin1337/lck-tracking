-- ============================================================
-- Migration 004 — Ofertas (múltiplas dashboards)
-- Cada oferta é um workspace: tem seus pixels, GA4, contas de anúncio,
-- token de webhook e dados (visitors/events/purchases) próprios.
-- NÃO-DESTRUTIVA: adiciona colunas (nullable) e migra os dados atuais
-- para uma oferta padrão "Iogurte". Rodar DEPOIS da 001.
-- ============================================================

-- 1) Tabela de ofertas
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  slug text not null,
  webhook_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, slug)
);

alter table offers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'offers' and policyname = 'read own'
  ) then
    create policy "read own" on offers for select using (auth.uid() = user_id);
  end if;
end $$;

-- updated_at automático (reusa a função da 001, se existir)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at')
     and not exists (
       select 1 from pg_trigger where tgname = 'offers_set_updated_at'
     ) then
    create trigger offers_set_updated_at
      before update on offers
      for each row execute function set_updated_at();
  end if;
end $$;

-- 2) Coluna offer_id nas tabelas (nullable por enquanto)
alter table visitors         add column if not exists offer_id uuid references offers;
alter table events_log       add column if not exists offer_id uuid references offers;
alter table purchases        add column if not exists offer_id uuid references offers;
alter table meta_pixels      add column if not exists offer_id uuid references offers;
alter table ga4_accounts     add column if not exists offer_id uuid references offers;
alter table meta_ad_accounts add column if not exists offer_id uuid references offers;

create index if not exists idx_visitors_offer  on visitors (offer_id);
create index if not exists idx_events_offer    on events_log (offer_id);
create index if not exists idx_purchases_offer on purchases (offer_id);

-- 3) Migração: cria a oferta padrão e carimba os dados existentes
do $$
declare
  owner_id uuid;
  off_id uuid;
  tok text;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;
  if owner_id is null then
    return;
  end if;

  -- Já migrado? não duplica.
  select id into off_id from offers where user_id = owner_id order by created_at asc limit 1;
  if off_id is not null then
    return;
  end if;

  select webhook_token into tok from settings where user_id = owner_id limit 1;

  insert into offers (user_id, name, slug, webhook_token)
  values (owner_id, 'Iogurte', 'iogurte', tok)
  returning id into off_id;

  update visitors         set offer_id = off_id where user_id = owner_id and offer_id is null;
  update events_log       set offer_id = off_id where user_id = owner_id and offer_id is null;
  update purchases        set offer_id = off_id where user_id = owner_id and offer_id is null;
  update meta_pixels      set offer_id = off_id where user_id = owner_id and offer_id is null;
  update ga4_accounts     set offer_id = off_id where user_id = owner_id and offer_id is null;
  update meta_ad_accounts set offer_id = off_id where user_id = owner_id and offer_id is null;
end $$;
