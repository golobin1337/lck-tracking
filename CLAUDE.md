# CLAUDE.md — Sistema de Tracking Server-Side

Guia de convenções e contexto do projeto. Manter atualizado a cada fase.

## O que é

Sistema de tracking server-side com painel. Captura visitantes e eventos no
servidor, envia conversões para **Meta Conversions API** e **GA4 Measurement
Protocol**, recebe compras via **webhook da Wiapy** (checkout do usuário), e
exibe tudo num painel autenticado (visão geral, eventos, faturamento, campanhas, geo).

## Stack

- **Next.js 16** (App Router, Turbopack por padrão) + React 19.2 + TypeScript
- **Supabase** (Postgres + Auth) — RLS em todas as tabelas
- **Tailwind CSS 4**
- Deploy na **Vercel**, código no **GitHub**

### Mudanças importantes do Next.js 16 (ler antes de codar)
- APIs de request são **assíncronas**: `await cookies()`, `await headers()`,
  `await params`, `await searchParams`. Sincrono foi removido.
- `middleware.ts` → **`proxy.ts`** (runtime nodejs, sem edge). Função exportada: `proxy`.
- Turbopack é padrão; scripts não precisam de `--turbopack`.
- Docs locais da versão instalada: `node_modules/next/dist/docs/`.

## Segurança (regras inegociáveis)

- **RLS ligada em TODAS as tabelas.** Leitura: só o dono autenticado
  (`auth.uid() = user_id`). Escrita: nenhuma policy → só `service_role`.
- `service_role` **só no servidor** (`src/lib/supabase/admin.ts`). Nunca em
  Client Component, nunca com `NEXT_PUBLIC_`.
- Em `env` só a infra do Supabase (URL/anon/service_role) + `ENCRYPTION_KEY`.
  Nada mais. `.env*` está no `.gitignore` — **nunca** commitar.
- **Credenciais de integrações (pixels, GA4, ad accounts, webhook_token) ficam
  no banco pelo painel**, não em env. Tokens/api_secret **cifrados** via pgcrypto
  (`encrypt_secret`/`decrypt_secret`), descriptografados só no servidor.
- Cadastro público **DESLIGADO** no Supabase Auth.
- Endpoints públicos (`/api/identify`, `/api/event`, `/api/webhook/compra`):
  validar entrada + rate limiting. Webhook exige `Authorization` header.

## Arquitetura de pastas

```
src/
  lib/supabase/
    client.ts   — browser (anon, RLS)
    server.ts   — Server Components / rotas autenticadas (anon + cookies, RLS)
    admin.ts    — service_role (bypassa RLS) — SÓ SERVIDOR
    proxy.ts    — updateSession (refresh de sessão + proteção de rotas)
  types/database.ts — tipos das tabelas
proxy.ts        — entrypoint do proxy (Next 16)
supabase/migrations/
  001_initial.sql       — schema, RLS, funções de cripto, triggers
  002_retention_cron.sql — pg_cron de retenção (habilitar pg_cron no dashboard)
```

## Versões de API em constante única

Quando uma API tem versão na URL, manter numa constante única e fácil de atualizar:
- Meta Graph API: `GRAPH_API_VERSION` em `src/lib/meta.ts` (Fase 3).
- GA4 MP endpoint: `src/lib/ga4.ts` (Fase 3).

Sempre conferir a doc oficial atual antes de integrar (Meta, Google, Supabase, Next.js).

## Webhook da Wiapy (resumo da doc)

- POST JSON; token no header **`Authorization`**; valores **em centavos**.
- Objetos: `payment`, `subscription`, `customer`, `checkout`, `products`, `tracking`.
- `payment.status`: `paid | unpaid | credit_card_declined | refunded | chargedback`.
- `tracking` já traz `ip`, `useragent`, `fbp`, `fbc`, `utm_*`.
- `trck_user_id` chega via `tracking.utm_content` (convenção na URL do checkout);
  fallback: casar por email/telefone.
- Disparar conversão (Meta/GA4) **só** quando `status === 'paid'` e ainda não enviada.
- Doc: https://ajuda.wiapy.com/wiapy/produtor/integracoes/webhook

## Fluxo de trabalho

- Construção **em fases**. Ao fim de cada fase: commit + aguardar aprovação do usuário.
- Orientação em português; mensagens de commit em português.

## Setup local (para rodar)

1. `npm install`
2. Criar projeto no Supabase; rodar `supabase/migrations/001_initial.sql` no SQL Editor.
3. Habilitar extensão `pg_cron` no dashboard e rodar `002_retention_cron.sql`.
4. Copiar `.env.example` → `.env.local` e preencher.
5. Desligar signup público em Supabase → Authentication → Providers/Settings.
6. `npm run dev`.
