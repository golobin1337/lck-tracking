import type { SupabaseClient } from '@supabase/supabase-js'

// Todas as consultas rodam via RLS (cliente autenticado do dono).

export type FunnelStage = { label: string; value: number }

export type OverviewStats = {
  uniqueVisitors: number
  totalEvents: number
  paidPurchases: number
  revenue: number
  conversionRate: number // 0..1
  funnel: FunnelStage[]
}

// Conta trck_user_id distintos que têm um dado evento.
async function distinctTrckWithEvent(
  supabase: SupabaseClient,
  eventName: string
): Promise<number> {
  const { data } = await supabase
    .from('events_log')
    .select('trck_user_id')
    .eq('event_name', eventName)
  return new Set(
    (data ?? []).map((e) => e.trck_user_id).filter((t): t is string => !!t)
  ).size
}

export async function getOverviewStats(
  supabase: SupabaseClient
): Promise<OverviewStats> {
  const [visitorsRes, eventsRes, paidRes] = await Promise.all([
    supabase.from('visitors').select('*', { count: 'exact', head: true }),
    supabase.from('events_log').select('*', { count: 'exact', head: true }),
    supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid'),
  ])
  const uniqueVisitors = visitorsRes.count ?? 0
  const totalEvents = eventsRes.count ?? 0
  const paidPurchases = paidRes.count ?? 0

  // Receita: soma de valor das compras pagas.
  const { data: paidRows } = await supabase
    .from('purchases')
    .select('valor')
    .eq('status', 'paid')
  const revenue = (paidRows ?? []).reduce(
    (sum, r) => sum + (Number(r.valor) || 0),
    0
  )

  // Funil de 5 etapas.
  const [pageViews, checkout, totalPurchasesRes] = await Promise.all([
    distinctTrckWithEvent(supabase, 'PageView'),
    distinctTrckWithEvent(supabase, 'InitiateCheckout'),
    supabase.from('purchases').select('*', { count: 'exact', head: true }),
  ])
  const salesInitiated = totalPurchasesRes.count ?? 0

  const conversionRate =
    uniqueVisitors > 0 ? paidPurchases / uniqueVisitors : 0

  return {
    uniqueVisitors,
    totalEvents,
    paidPurchases,
    revenue,
    conversionRate,
    funnel: [
      { label: 'Visitantes', value: uniqueVisitors },
      { label: 'Visualizações', value: pageViews },
      { label: 'Checkout', value: checkout },
      { label: 'Vendas inic.', value: salesInitiated },
      { label: 'Vendas apr.', value: paidPurchases },
    ],
  }
}

export type DayCount = { date: string; count: number }

export async function getEventsPerDay(
  supabase: SupabaseClient,
  days = 30
): Promise<DayCount[]> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('events_log')
    .select('created_at')
    .gte('created_at', since.toISOString())

  // Mapa data (YYYY-MM-DD) → contagem
  const map = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    map.set(d.toISOString().slice(0, 10), 0)
  }
  for (const row of data ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10)
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map, ([date, count]) => ({ date, count }))
}

// Receita e nº de compras pagas agrupadas por utm_campaign (chave minúscula).
export async function getRevenueByCampaign(
  supabase: SupabaseClient
): Promise<Map<string, { revenue: number; count: number }>> {
  const { data } = await supabase
    .from('purchases')
    .select('valor, utm_campaign')
    .eq('status', 'paid')
  const map = new Map<string, { revenue: number; count: number }>()
  for (const row of data ?? []) {
    const key = (row.utm_campaign ?? '').toLowerCase()
    if (!key) continue
    const cur = map.get(key) ?? { revenue: 0, count: 0 }
    cur.revenue += Number(row.valor) || 0
    cur.count += 1
    map.set(key, cur)
  }
  return map
}

export type GeoBucket = { key: string; label: string; count: number }
export type GeoBreakdown = {
  countries: GeoBucket[]
  states: GeoBucket[]
  cities: GeoBucket[]
  total: number
  located: number
}

export async function getGeoBreakdown(
  supabase: SupabaseClient
): Promise<GeoBreakdown> {
  const { data } = await supabase.from('visitors').select('geo')
  const rows = data ?? []

  const countries = new Map<string, number>()
  const states = new Map<string, number>()
  const cities = new Map<string, number>()
  let located = 0

  for (const r of rows) {
    const geo = r.geo as {
      country?: string | null
      state?: string | null
      city?: string | null
    } | null
    if (!geo) continue
    let any = false
    if (geo.country) {
      countries.set(geo.country, (countries.get(geo.country) ?? 0) + 1)
      any = true
    }
    if (geo.state) {
      states.set(geo.state, (states.get(geo.state) ?? 0) + 1)
      any = true
    }
    if (geo.city) {
      cities.set(geo.city, (cities.get(geo.city) ?? 0) + 1)
      any = true
    }
    if (any) located++
  }

  const toSorted = (m: Map<string, number>, labelFn?: (k: string) => string) =>
    Array.from(m, ([key, count]) => ({
      key,
      label: labelFn ? labelFn(key) : key,
      count,
    })).sort((a, b) => b.count - a.count)

  return {
    countries: toSorted(countries),
    states: toSorted(states),
    cities: toSorted(cities),
    total: rows.length,
    located,
  }
}

export type RevenueStats = {
  revenue: number
  paidCount: number
  avgTicket: number
  refundedCount: number
  refundedAmount: number
}

export async function getRevenueStats(
  supabase: SupabaseClient
): Promise<RevenueStats> {
  const { data: paid } = await supabase
    .from('purchases')
    .select('valor')
    .eq('status', 'paid')
  const revenue = (paid ?? []).reduce((s, r) => s + (Number(r.valor) || 0), 0)
  const paidCount = paid?.length ?? 0

  const { data: refunded } = await supabase
    .from('purchases')
    .select('valor')
    .in('status', ['refunded', 'chargedback'])
  const refundedAmount = (refunded ?? []).reduce(
    (s, r) => s + (Number(r.valor) || 0),
    0
  )

  return {
    revenue,
    paidCount,
    avgTicket: paidCount > 0 ? revenue / paidCount : 0,
    refundedCount: refunded?.length ?? 0,
    refundedAmount,
  }
}
