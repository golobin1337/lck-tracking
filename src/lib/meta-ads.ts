import { GRAPH_API_VERSION } from '@/lib/meta'

// ============================================================
// Meta Ads — Insights API (campanha → conjunto → anúncio)
// Doc: https://developers.facebook.com/docs/marketing-api/insights
// CACHE + rate limit CONSERVADOR (bem abaixo do documentado) para nunca abusar.
// ============================================================

const GRAPH_API_BASE = 'https://graph.facebook.com'

// Cache em memória (por instância). Serve dados por até 30 min.
export const AD_INSIGHTS_TTL_MS = 30 * 60_000
// Piso rígido entre chamadas reais à Meta por conta, mesmo em refresh manual.
const MIN_REFRESH_MS = 5 * 60_000

// Timeout + "circuit breaker": a chamada à Meta nunca pode travar a navegação.
// Se a Meta falhar (ex.: token bloqueado), paramos de chamar por 5 min.
const META_TIMEOUT_MS = 4000
let metaDownUntil = 0
let lastMetaError: string | null = null
function metaIsDown(): boolean {
  return Date.now() < metaDownUntil
}
function markMetaDown(msg?: string): void {
  metaDownUntil = Date.now() + 5 * 60_000
  if (msg) lastMetaError = msg
}
function markMetaUp(): void {
  metaDownUntil = 0
  lastMetaError = null
}
function downReason(): string {
  return lastMetaError ?? 'meta_down'
}
async function metaFetch(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), META_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ---- Câmbio: converte o gasto de contas em moeda estrangeira para BRL ----
// (ex.: contas em USD). Cotação cacheada por 1h via AwesomeAPI (BRL).
const fxCache = new Map<string, { rate: number; fetchedAt: number }>()
async function fxToBrl(currency?: string): Promise<number> {
  const cur = (currency || 'BRL').toUpperCase()
  if (cur === 'BRL') return 1
  const now = Date.now()
  const cached = fxCache.get(cur)
  if (cached && now - cached.fetchedAt < 60 * 60_000) return cached.rate
  try {
    const r = await fetch(
      `https://economia.awesomeapi.com.br/last/${cur}-BRL`
    )
    const b = await r.json().catch(() => null)
    const rate = Number(b?.[`${cur}BRL`]?.bid)
    if (rate && rate > 0) {
      fxCache.set(cur, { rate, fetchedAt: now })
      return rate
    }
  } catch {
    /* usa fallback abaixo */
  }
  return cached?.rate ?? (cur === 'USD' ? 5.5 : 1)
}

export type AdInsightRow = {
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  ad_id: string
  ad_name: string
  spend: number
  impressions: number
  clicks: number
}

type CacheEntry = {
  rows: AdInsightRow[]
  fetchedAt: number
  error: string | null
}

const cache = new Map<string, CacheEntry>()

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'this_month'
  | 'last_month'

function normalizeAccountId(id: string): string {
  return id.startsWith('act_') ? id : `act_${id}`
}

export type InsightsResult = {
  rows: AdInsightRow[]
  fetchedAt: number
  cached: boolean
  throttled: boolean
  error: string | null
}

export async function fetchAdInsights(
  account: { id: string; ad_account_id: string; token: string },
  datePreset: DatePreset = 'last_30d',
  force = false
): Promise<InsightsResult> {
  const key = `${account.id}:${datePreset}`
  const now = Date.now()
  const entry = cache.get(key)

  // Dentro do TTL e sem forçar → serve cache.
  if (entry && !force && now - entry.fetchedAt < AD_INSIGHTS_TTL_MS) {
    return {
      rows: entry.rows,
      fetchedAt: entry.fetchedAt,
      cached: true,
      throttled: false,
      error: entry.error,
    }
  }
  // Refresh forçado, mas dentro do piso → serve cache (protege a cota).
  if (entry && force && now - entry.fetchedAt < MIN_REFRESH_MS) {
    return {
      rows: entry.rows,
      fetchedAt: entry.fetchedAt,
      cached: true,
      throttled: true,
      error: entry.error,
    }
  }

  // Meta fora do ar recentemente → não chama (resposta instantânea).
  if (metaIsDown()) {
    return {
      rows: entry?.rows ?? [],
      fetchedAt: entry?.fetchedAt ?? now,
      cached: true,
      throttled: false,
      error: entry?.error ?? downReason(),
    }
  }

  const fields =
    'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,account_currency'
  const url =
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${normalizeAccountId(
      account.ad_account_id
    )}/insights` +
    `?level=ad&fields=${fields}&date_preset=${datePreset}&limit=500` +
    `&access_token=${encodeURIComponent(account.token)}`

  try {
    const res = await metaFetch(url)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      // Erro rápido (ex.: conta bloqueada) → NÃO trava o breaker (é por-conta).
      const msg = body?.error?.message || `HTTP ${res.status}`
      lastMetaError = msg
      const fallback = entry?.rows ?? []
      const result: CacheEntry = {
        rows: fallback,
        fetchedAt: now,
        error: msg,
      }
      cache.set(key, result)
      return { ...result, cached: false, throttled: false }
    }
    markMetaUp()

    const data: Record<string, unknown>[] = body?.data ?? []
    const rate = await fxToBrl(data[0]?.account_currency as string)
    const rows: AdInsightRow[] = data.map((r) => ({
      campaign_id: String(r.campaign_id ?? ''),
      campaign_name: String(r.campaign_name ?? '—'),
      adset_id: String(r.adset_id ?? ''),
      adset_name: String(r.adset_name ?? '—'),
      ad_id: String(r.ad_id ?? ''),
      ad_name: String(r.ad_name ?? '—'),
      spend: Number(r.spend ?? 0) * rate,
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
    }))
    const result: CacheEntry = { rows, fetchedAt: now, error: null }
    cache.set(key, result)
    return { ...result, cached: false, throttled: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    markMetaDown(msg)
    const fallback = entry?.rows ?? []
    const result: CacheEntry = { rows: fallback, fetchedAt: now, error: msg }
    cache.set(key, result)
    return { ...result, cached: false, throttled: false }
  }
}

// ---- Totais (cliques + gasto) por período arbitrário ----
// Usa time_range (since/until em YYYY-MM-DD) e cacheia por conta+período.
// Uma chamada serve o funil (cliques) e o faturamento (gasto).
const totalsCache = new Map<
  string,
  { clicks: number; spend: number; fetchedAt: number; error: string | null }
>()

export async function fetchAdTotals(
  account: { id: string; ad_account_id: string; token: string },
  since: string,
  until: string
): Promise<{ clicks: number; spend: number; error: string | null }> {
  const key = `${account.id}:${since}:${until}`
  const now = Date.now()
  const entry = totalsCache.get(key)
  if (entry && now - entry.fetchedAt < AD_INSIGHTS_TTL_MS) {
    return { clicks: entry.clicks, spend: entry.spend, error: entry.error }
  }
  // Meta fora do ar recentemente → não chama (resposta instantânea).
  if (metaIsDown()) {
    return {
      clicks: entry?.clicks ?? 0,
      spend: entry?.spend ?? 0,
      error: downReason(),
    }
  }

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
  const url =
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${normalizeAccountId(
      account.ad_account_id
    )}/insights` +
    `?level=account&fields=clicks,spend,account_currency&time_range=${timeRange}` +
    `&access_token=${encodeURIComponent(account.token)}`

  try {
    const res = await metaFetch(url)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      // Erro rápido por-conta (ex.: bloqueada) → não trava o breaker global.
      const msg = body?.error?.message || `HTTP ${res.status}`
      lastMetaError = msg
      const clicks = entry?.clicks ?? 0
      const spend = entry?.spend ?? 0
      totalsCache.set(key, { clicks, spend, fetchedAt: now, error: msg })
      return { clicks, spend, error: msg }
    }
    markMetaUp()
    const rows: Record<string, unknown>[] = body?.data ?? []
    const rate = await fxToBrl(rows[0]?.account_currency as string)
    const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0)
    const spend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0) * rate
    totalsCache.set(key, { clicks, spend, fetchedAt: now, error: null })
    return { clicks, spend, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    markMetaDown(msg)
    const clicks = entry?.clicks ?? 0
    const spend = entry?.spend ?? 0
    totalsCache.set(key, { clicks, spend, fetchedAt: now, error: msg })
    return { clicks, spend, error: msg }
  }
}

// Soma os cliques de todas as contas ativas no período.
export async function getAdClicksTotal(
  accounts: { id: string; ad_account_id: string; token: string }[],
  since: string,
  until: string
): Promise<number> {
  const results = await Promise.all(
    accounts.map((acc) => fetchAdTotals(acc, since, until))
  )
  return results.reduce((s, r) => s + r.clicks, 0)
}

// Soma o gasto (investimento) de todas as contas ativas no período.
export async function getAdSpendTotal(
  accounts: { id: string; ad_account_id: string; token: string }[],
  since: string,
  until: string
): Promise<number> {
  const results = await Promise.all(
    accounts.map((acc) => fetchAdTotals(acc, since, until))
  )
  return results.reduce((s, r) => s + r.spend, 0)
}

// ---- Gasto por hora do dia (0..23) via breakdown da Meta ----
const hourlyCache = new Map<
  string,
  { hours: number[]; fetchedAt: number }
>()

async function fetchAdSpendByHourAccount(
  account: { id: string; ad_account_id: string; token: string },
  since: string,
  until: string
): Promise<number[]> {
  const key = `${account.id}:${since}:${until}:hourly`
  const now = Date.now()
  const entry = hourlyCache.get(key)
  if (entry && now - entry.fetchedAt < AD_INSIGHTS_TTL_MS) return entry.hours

  const hours = new Array(24).fill(0)
  if (metaIsDown()) return entry?.hours ?? hours

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
  const url =
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${normalizeAccountId(
      account.ad_account_id
    )}/insights` +
    `?level=account&fields=spend,account_currency` +
    `&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone` +
    `&time_range=${timeRange}&access_token=${encodeURIComponent(account.token)}`

  try {
    const res = await metaFetch(url)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      // Erro rápido por-conta → não trava o breaker global.
      lastMetaError = body?.error?.message || `HTTP ${res.status}`
      hourlyCache.set(key, { hours, fetchedAt: now }) // cacheia zeros no erro
      return hours
    }
    markMetaUp()
    const rowsH: Record<string, unknown>[] = body?.data ?? []
    const rateH = await fxToBrl(rowsH[0]?.account_currency as string)
    for (const r of rowsH) {
      const slot = String(
        r.hourly_stats_aggregated_by_advertiser_time_zone ?? ''
      )
      const h = parseInt(slot.slice(0, 2), 10)
      if (h >= 0 && h < 24) hours[h] += (Number(r.spend) || 0) * rateH
    }
    hourlyCache.set(key, { hours, fetchedAt: now })
    return hours
  } catch {
    markMetaDown()
    hourlyCache.set(key, { hours, fetchedAt: now })
    return hours
  }
}

export async function getAdSpendByHour(
  accounts: { id: string; ad_account_id: string; token: string }[],
  since: string,
  until: string
): Promise<number[]> {
  const arrs = await Promise.all(
    accounts.map((acc) => fetchAdSpendByHourAccount(acc, since, until))
  )
  const total = new Array(24).fill(0)
  for (const h of arrs) for (let i = 0; i < 24; i++) total[i] += h[i]
  return total
}

// ---- Agregação em árvore campanha → conjunto → anúncio ----
export type AdNode = {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
}
export type AdsetNode = AdNode & { ads: AdNode[] }
export type CampaignNode = AdNode & {
  adsets: AdsetNode[]
  // cruzamento com receita (por utm_campaign)
  revenue: number
  purchases: number
  roas: number | null
  cpa: number | null
}

export function buildCampaignTree(
  rows: AdInsightRow[],
  revenueByCampaign: Map<string, { revenue: number; count: number }>
): CampaignNode[] {
  const campaigns = new Map<string, CampaignNode>()

  for (const r of rows) {
    let camp = campaigns.get(r.campaign_id)
    if (!camp) {
      camp = {
        id: r.campaign_id,
        name: r.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        adsets: [],
        revenue: 0,
        purchases: 0,
        roas: null,
        cpa: null,
      }
      campaigns.set(r.campaign_id, camp)
    }
    camp.spend += r.spend
    camp.impressions += r.impressions
    camp.clicks += r.clicks

    let adset = camp.adsets.find((a) => a.id === r.adset_id)
    if (!adset) {
      adset = {
        id: r.adset_id,
        name: r.adset_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ads: [],
      }
      camp.adsets.push(adset)
    }
    adset.spend += r.spend
    adset.impressions += r.impressions
    adset.clicks += r.clicks

    adset.ads.push({
      id: r.ad_id,
      name: r.ad_name,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
    })
  }

  // Cruzar receita por nome de campanha (= utm_campaign, case-insensitive).
  for (const camp of campaigns.values()) {
    const rev = revenueByCampaign.get(camp.name.toLowerCase())
    if (rev) {
      camp.revenue = rev.revenue
      camp.purchases = rev.count
    }
    camp.roas = camp.spend > 0 ? camp.revenue / camp.spend : null
    camp.cpa = camp.purchases > 0 ? camp.spend / camp.purchases : null
  }

  return Array.from(campaigns.values()).sort((a, b) => b.spend - a.spend)
}
