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

  const fields =
    'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks'
  const url =
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${normalizeAccountId(
      account.ad_account_id
    )}/insights` +
    `?level=ad&fields=${fields}&date_preset=${datePreset}&limit=500` +
    `&access_token=${encodeURIComponent(account.token)}`

  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const msg =
        body?.error?.message || `HTTP ${res.status}`
      const fallback = entry?.rows ?? []
      const result: CacheEntry = {
        rows: fallback,
        fetchedAt: now,
        error: msg,
      }
      cache.set(key, result)
      return { ...result, cached: false, throttled: false }
    }

    const rows: AdInsightRow[] = (body?.data ?? []).map(
      (r: Record<string, unknown>) => ({
        campaign_id: String(r.campaign_id ?? ''),
        campaign_name: String(r.campaign_name ?? '—'),
        adset_id: String(r.adset_id ?? ''),
        adset_name: String(r.adset_name ?? '—'),
        ad_id: String(r.ad_id ?? ''),
        ad_name: String(r.ad_name ?? '—'),
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
      })
    )
    const result: CacheEntry = { rows, fetchedAt: now, error: null }
    cache.set(key, result)
    return { ...result, cached: false, throttled: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const fallback = entry?.rows ?? []
    const result: CacheEntry = { rows: fallback, fetchedAt: now, error: msg }
    cache.set(key, result)
    return { ...result, cached: false, throttled: false }
  }
}

// ---- Total de cliques por período arbitrário (para o funil) ----
// Usa time_range (since/until em YYYY-MM-DD) e cacheia por conta+período.
const clicksCache = new Map<
  string,
  { clicks: number; fetchedAt: number; error: string | null }
>()

export async function fetchAdClicks(
  account: { id: string; ad_account_id: string; token: string },
  since: string,
  until: string
): Promise<{ clicks: number; error: string | null }> {
  const key = `${account.id}:${since}:${until}`
  const now = Date.now()
  const entry = clicksCache.get(key)
  if (entry && now - entry.fetchedAt < AD_INSIGHTS_TTL_MS) {
    return { clicks: entry.clicks, error: entry.error }
  }

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))
  const url =
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${normalizeAccountId(
      account.ad_account_id
    )}/insights` +
    `?level=account&fields=clicks&time_range=${timeRange}` +
    `&access_token=${encodeURIComponent(account.token)}`

  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`
      const clicks = entry?.clicks ?? 0
      clicksCache.set(key, { clicks, fetchedAt: now, error: msg })
      return { clicks, error: msg }
    }
    const clicks = (body?.data ?? []).reduce(
      (s: number, r: Record<string, unknown>) => s + Number(r.clicks ?? 0),
      0
    )
    clicksCache.set(key, { clicks, fetchedAt: now, error: null })
    return { clicks, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const clicks = entry?.clicks ?? 0
    clicksCache.set(key, { clicks, fetchedAt: now, error: msg })
    return { clicks, error: msg }
  }
}

// Soma os cliques de todas as contas ativas no período.
export async function getAdClicksTotal(
  accounts: { id: string; ad_account_id: string; token: string }[],
  since: string,
  until: string
): Promise<number> {
  let total = 0
  for (const acc of accounts) {
    const { clicks } = await fetchAdClicks(acc, since, until)
    total += clicks
  }
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
