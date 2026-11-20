import type { SupabaseClient } from '@supabase/supabase-js'

// Todas as consultas rodam via RLS (cliente autenticado do dono).

// Período de análise. from/to são instantes ISO (UTC). tz = offset em minutos
// (Date.getTimezoneOffset do cliente) para agrupar por dia no fuso do usuário.
export type DateRange = { from: string; to: string; tz?: number }

// Aplica o filtro de created_at num query builder do Supabase (quando há range).
interface Rangeable {
  gte(c: string, v: string): Rangeable
  lte(c: string, v: string): Rangeable
}
function inRange<T>(query: T, range?: DateRange, col = 'created_at'): T {
  if (!range) return query
  const q = query as unknown as Rangeable
  return q.gte(col, range.from).lte(col, range.to) as unknown as T
}

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
  eventName: string,
  range?: DateRange
): Promise<number> {
  const { data } = await inRange(
    supabase.from('events_log').select('trck_user_id').eq('event_name', eventName),
    range
  )
  return new Set(
    (data ?? []).map((e) => e.trck_user_id).filter((t): t is string => !!t)
  ).size
}

export async function getOverviewStats(
  supabase: SupabaseClient,
  range?: DateRange,
  adClicks = 0
): Promise<OverviewStats> {
  const [visitorsRes, eventsRes, paidRes] = await Promise.all([
    inRange(
      supabase.from('visitors').select('*', { count: 'exact', head: true }),
      range
    ),
    inRange(
      supabase.from('events_log').select('*', { count: 'exact', head: true }),
      range
    ),
    inRange(
      supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid'),
      range
    ),
  ])
  const uniqueVisitors = visitorsRes.count ?? 0
  const totalEvents = eventsRes.count ?? 0
  const paidPurchases = paidRes.count ?? 0

  // Receita: soma de valor das compras pagas.
  const { data: paidRows } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'paid'),
    range
  )
  const revenue = (paidRows ?? []).reduce(
    (sum, r) => sum + (Number(r.valor) || 0),
    0
  )

  // Funil de 5 etapas.
  const [pageViews, checkout, totalPurchasesRes] = await Promise.all([
    distinctTrckWithEvent(supabase, 'PageView', range),
    distinctTrckWithEvent(supabase, 'InitiateCheckout', range),
    inRange(
      supabase.from('purchases').select('*', { count: 'exact', head: true }),
      range
    ),
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
      { label: 'Cliques', value: adClicks },
      { label: 'Visitas na página', value: pageViews },
      { label: 'Checkout', value: checkout },
      { label: 'Vendas inic.', value: salesInitiated },
      { label: 'Vendas apr.', value: paidPurchases },
    ],
  }
}

export type DayCount = { date: string; count: number }

export async function getEventsPerDay(
  supabase: SupabaseClient,
  range?: DateRange
): Promise<DayCount[]> {
  const tz = range?.tz ?? 0
  const now = new Date()
  const fromIso =
    range?.from ?? new Date(now.getTime() - 29 * 864e5).toISOString()
  const toIso = range?.to ?? now.toISOString()

  const { data } = await supabase
    .from('events_log')
    .select('created_at')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)

  // Chave de dia no fuso do usuário (YYYY-MM-DD).
  const dayKey = (iso: string) =>
    new Date(new Date(iso).getTime() - tz * 60000).toISOString().slice(0, 10)

  const map = new Map<string, number>()
  let d = new Date(dayKey(fromIso) + 'T00:00:00Z')
  const end = new Date(dayKey(toIso) + 'T00:00:00Z')
  let guard = 0
  while (d <= end && guard < 400) {
    map.set(d.toISOString().slice(0, 10), 0)
    d = new Date(d.getTime() + 864e5)
    guard++
  }
  for (const row of data ?? []) {
    const key = dayKey(row.created_at)
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
  supabase: SupabaseClient,
  range?: DateRange
): Promise<GeoBreakdown> {
  const { data } = await inRange(supabase.from('visitors').select('geo'), range)
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

export type PaymentSlice = {
  key: string
  label: string
  count: number
  color: string
}

// Distribuição de compras pagas por método de pagamento.
export async function getPaymentBreakdown(
  supabase: SupabaseClient,
  range?: DateRange
): Promise<PaymentSlice[]> {
  const { data } = await inRange(
    supabase.from('purchases').select('payment_method').eq('status', 'paid'),
    range
  )
  const c = { pix: 0, card: 0, boleto: 0, outros: 0 }
  for (const r of data ?? []) {
    const m = (r.payment_method ?? '').toLowerCase()
    if (m === 'pix') c.pix++
    else if (m === 'credit_card' || m === 'card' || m === 'cartao') c.card++
    else if (m === 'boleto') c.boleto++
    else c.outros++
  }
  return [
    { key: 'pix', label: 'Pix', count: c.pix, color: 'hsl(222 85% 58%)' },
    { key: 'card', label: 'Cartão', count: c.card, color: 'hsl(var(--cyan))' },
    { key: 'boleto', label: 'Boleto', count: c.boleto, color: 'hsl(var(--amber))' },
    { key: 'outros', label: 'Outros', count: c.outros, color: 'hsl(var(--destructive))' },
  ]
}

export type ApprovalRate = {
  key: string
  label: string
  rate: number | null // 0..1, ou null quando não houve pedidos
  color: string
}

// Taxa de aprovação por método = aprovados / gerados.
// Aprovado = pagamento que passou (paid, refunded, chargedback).
export async function getApprovalRates(
  supabase: SupabaseClient,
  range?: DateRange
): Promise<ApprovalRate[]> {
  const { data } = await inRange(
    supabase.from('purchases').select('payment_method, status'),
    range
  )
  const agg: Record<string, { a: number; t: number }> = {
    card: { a: 0, t: 0 },
    pix: { a: 0, t: 0 },
    boleto: { a: 0, t: 0 },
  }
  const approved = new Set(['paid', 'refunded', 'chargedback'])
  for (const r of data ?? []) {
    const m = (r.payment_method ?? '').toLowerCase()
    const key =
      m === 'pix'
        ? 'pix'
        : m === 'credit_card' || m === 'card' || m === 'cartao'
          ? 'card'
          : m === 'boleto'
            ? 'boleto'
            : null
    if (!key) continue
    agg[key].t++
    if (approved.has((r.status ?? '').toLowerCase())) agg[key].a++
  }
  const mk = (key: string, label: string, color: string): ApprovalRate => ({
    key,
    label,
    color,
    rate: agg[key].t > 0 ? agg[key].a / agg[key].t : null,
  })
  return [
    mk('card', 'Cartão', 'hsl(var(--cyan))'),
    mk('pix', 'Pix', 'hsl(222 85% 58%)'),
    mk('boleto', 'Boleto', 'hsl(var(--amber))'),
  ]
}

export type RevenueStats = {
  revenue: number
  paidCount: number
  avgTicket: number
  refundedCount: number
  refundedAmount: number
  pendingCount: number
  pendingAmount: number
}

export async function getRevenueStats(
  supabase: SupabaseClient,
  range?: DateRange
): Promise<RevenueStats> {
  const { data: paid } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'paid'),
    range
  )
  const revenue = (paid ?? []).reduce((s, r) => s + (Number(r.valor) || 0), 0)
  const paidCount = paid?.length ?? 0

  const { data: refunded } = await inRange(
    supabase
      .from('purchases')
      .select('valor')
      .in('status', ['refunded', 'chargedback']),
    range
  )
  const refundedAmount = (refunded ?? []).reduce(
    (s, r) => s + (Number(r.valor) || 0),
    0
  )

  // Pendentes: aguardando pagamento (Pix/boleto gerado, ainda não pago).
  const { data: pending } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'unpaid'),
    range
  )
  const pendingAmount = (pending ?? []).reduce(
    (s, r) => s + (Number(r.valor) || 0),
    0
  )

  return {
    revenue,
    paidCount,
    avgTicket: paidCount > 0 ? revenue / paidCount : 0,
    refundedCount: refunded?.length ?? 0,
    refundedAmount,
    pendingCount: pending?.length ?? 0,
    pendingAmount,
  }
}
