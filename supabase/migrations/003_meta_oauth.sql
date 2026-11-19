-- ============================================================
-- Migration 003 — Meta OAuth (Login com Facebook, estilo UTMify)
-- Guarda as credenciais do App do Facebook (App ID público + App Secret
-- cifrado) usadas no fluxo OAuth que gera o token de anúncios válido.
-- Rodar DEPOIS da 001.
-- ============================================================

alter table settings add column if not exists fb_app_id text;
alter table settings add column if not exists fb_app_secret_enc text;
