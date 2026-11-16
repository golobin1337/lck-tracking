-- ============================================================
-- Migration 002 — Retenção de logs (pg_cron)
-- PRÉ-REQUISITO: habilitar a extensão "pg_cron" no painel do Supabase
--   Database → Extensions → pg_cron (ou rodar o create abaixo se permitido).
-- Rodar DEPOIS da 001.
-- ============================================================

create extension if not exists pg_cron;

-- Zera os campos pesados dos events_log com mais de 14 dias,
-- em lotes, SEM apagar a linha (mantém data, evento, UTMs e geo).
create or replace function public.purge_old_event_payloads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected int;
begin
  loop
    with batch as (
      select id
      from public.events_log
      where created_at < now() - interval '14 days'
        and (payload_meta is not null
          or response_meta is not null
          or payload_ga4 is not null
          or response_ga4 is not null)
      limit 2000
    )
    update public.events_log e
    set payload_meta = null,
        response_meta = null,
        payload_ga4 = null,
        response_ga4 = null
    from batch
    where e.id = batch.id;

    get diagnostics rows_affected = row_count;
    exit when rows_affected = 0;
  end loop;
end;
$$;

revoke all on function public.purge_old_event_payloads() from public, anon, authenticated;

-- Agenda diária às 03:00 (horário do servidor do banco, UTC no Supabase).
-- Remove agendamento anterior de mesmo nome antes de recriar (idempotente).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-event-payloads') then
    perform cron.unschedule('cleanup-event-payloads');
  end if;
end $$;

select cron.schedule(
  'cleanup-event-payloads',
  '0 3 * * *',
  $$ select public.purge_old_event_payloads(); $$
);
