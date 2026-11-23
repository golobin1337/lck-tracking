import type { SupabaseClient } from '@supabase/supabase-js'

// Todas as consultas rodam via RLS (cliente autenticado do dono).

// Período de análise. from/to são instantes ISO (UTC). tz = offset em minutos
// (Date.getTimezoneOffset do cliente) para agrupar por dia no fuso do usuário.
export type DateRange = { from: string; to: string; tz?: number }

// Filtra por oferta (offer_id) e por período (created_at) num query builder.
interface Scopable {
  eq(c: string, v: string): Scopable
  gte(c: string, v: string): Scopable
  lte(c: string, v: string): Scopable
}
function inRange<T>(
  query: T,
  range?: DateRange,
  offerId?: string | null
): T {
  let q = query as unknown as Scopable
  if (offerId) q = q.eq('offer_id', offerId)
  if (range) q = q.gte('created_at', range.from).lte('created_at', range.to)
  return q as unknown as T
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
  range?: DateRange,
  offerId?: string | null
): Promise<number> {
  const { data } = await inRange(
    supabase.from('events_log').select('trck_user_id').eq('event_name', eventName),
    range,
    offerId
  )
  return new Set(
    (data ?? []).map((e) => e.trck_user_id).filter((t): t is string => !!t)
  ).size
}

export async function getOverviewStats(
  supabase: SupabaseClient,
  range?: DateRange,
  adClicks = 0,
  offerId?: string | null
): Promise<OverviewStats> {
  const [visitorsRes, eventsRes, paidRes] = await Promise.all([
    inRange(
      supabase.from('visitors').select('*', { count: 'exact', head: true }),
      range,
      offerId
    ),
    inRange(
      supabase.from('events_log').select('*', { count: 'exact', head: true }),
      range,
      offerId
    ),
    inRange(
      supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid'),
      range,
      offerId
    ),
  ])
  const uniqueVisitors = visitorsRes.count ?? 0
  const totalEvents = eventsRes.count ?? 0
  const paidPurchases = paidRes.count ?? 0

  // Receita: soma de valor das compras pagas.
  const { data: paidRows } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'paid'),
    range,
    offerId
  )
  const revenue = (paidRows ?? []).reduce(
    (sum, r) => sum + (Number(r.valor) || 0),
    0
  )

  // Funil de 5 etapas.
  const [pageViews, checkout, totalPurchasesRes] = await Promise.all([
    distinctTrckWithEvent(supabase, 'PageView', range, offerId),
    distinctTrckWithEvent(supabase, 'InitiateCheckout', range, offerId),
    inRange(
      supabase.from('purchases').select('*', { count: 'exact', head: true }),
      range,
      offerId
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
  range?: DateRange,
  offerId?: string | null
): Promise<DayCount[]> {
  const tz = range?.tz ?? 0
  const now = new Date()
  const fromIso =
    range?.from ?? new Date(now.getTime() - 29 * 864e5).toISOString()
  const toIso = range?.to ?? now.toISOString()

  let q = supabase
    .from('events_log')
    .select('created_at')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  if (offerId) q = q.eq('offer_id', offerId)
  const { data } = await q

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
  supabase: SupabaseClient,
  offerId?: string | null
): Promise<Map<string, { revenue: number; count: number }>> {
  let q = supabase
    .from('purchases')
    .select('valor, utm_campaign')
    .eq('status', 'paid')
  if (offerId) q = q.eq('offer_id', offerId)
  const { data } = await q
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

// Extrai o ID do Meta de um UTM no formato UTMify ("nome|<id>::<fbclid>::").
export function extractMetaId(s?: string | null): string | null {
  if (!s) return null
  let p = String(s)
  const pipe = p.lastIndexOf('|')
  if (pipe >= 0) p = p.slice(pipe + 1)
  const colon = p.indexOf('::')
  if (colon >= 0) p = p.slice(0, colon)
  p = p.trim()
  return /^\d{5,}$/.test(p) ? p : null
}

// Receita + nº de vendas por ID do Meta (campanha/conjunto/anúncio), lendo o UTM
// correspondente (utm_campaign / utm_medium / utm_content).
export async function getRevenueByMetaId(
  supabase: SupabaseClient,
  column: 'utm_campaign' | 'utm_medium' | 'utm_content',
  offerId?: string | null,
  range?: { from: string; to: string }
): Promise<Map<string, { revenue: number; count: number }>> {
  let q = supabase
    .from('purchases')
    .select(`valor, ${column}`)
    .eq('status', 'paid')
  if (offerId) q = q.eq('offer_id', offerId)
  if (range) q = q.gte('created_at', range.from).lte('created_at', range.to)
  const { data } = await q
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = extractMetaId(r[column] as string)
    if (!id) continue
    const cur = map.get(id) ?? { revenue: 0, count: 0 }
    cur.revenue += Number(r.valor) || 0
    cur.count += 1
    map.set(id, cur)
  }
  return map
}

export async function getCheckoutByMetaId(
  supabase: SupabaseClient,
  column: 'utm_campaign' | 'utm_medium' | 'utm_content',
  offerId?: string | null,
  range?: { from: string; to: string }
): Promise<Map<string, number>> {
  let q = supabase
    .from('events_log')
    .select(column)
    .eq('event_name', 'InitiateCheckout')
  if (offerId) q = q.eq('offer_id', offerId)
  if (range) q = q.gte('created_at', range.from).lte('created_at', range.to)
  const { data } = await q
  const map = new Map<string, number>()
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = extractMetaId(r[column] as string)
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}

// Nº de InitiateCheckout por utm_campaign (chave minúscula) — para a aba Campanhas.
export async function getCheckoutByCampaign(
  supabase: SupabaseClient,
  offerId?: string | null
): Promise<Map<string, number>> {
  let q = supabase
    .from('events_log')
    .select('utm_campaign')
    .eq('event_name', 'InitiateCheckout')
  if (offerId) q = q.eq('offer_id', offerId)
  const { data } = await q
  const map = new Map<string, number>()
  for (const r of data ?? []) {
    const k = (r.utm_campaign ?? '').toLowerCase()
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
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
  range?: DateRange,
  offerId?: string | null
): Promise<GeoBreakdown> {
  const { data } = await inRange(
    supabase.from('visitors').select('geo'),
    range,
    offerId
  )
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
  range?: DateRange,
  offerId?: string | null
): Promise<PaymentSlice[]> {
  const { data } = await inRange(
    supabase.from('purchases').select('payment_method').eq('status', 'paid'),
    range,
    offerId
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

export type HourBucket = {
  hour: number
  label: string
  count: number
  revenue: number
}

// Compras pagas agrupadas por hora do dia (no fuso do usuário).
export async function getSalesByHour(
  supabase: SupabaseClient,
  range?: DateRange,
  offerId?: string | null
): Promise<HourBucket[]> {
  const tz = range?.tz ?? 0
  const { data } = await inRange(
    supabase.from('purchases').select('created_at, valor').eq('status', 'paid'),
    range,
    offerId
  )
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    count: 0,
    revenue: 0,
  }))
  for (const r of data ?? []) {
    const h = new Date(
      new Date(r.created_at).getTime() - tz * 60000
    ).getUTCHours()
    buckets[h].count++
    buckets[h].revenue += Number(r.valor) || 0
  }
  return buckets
}

export type ProductSlice = { produto: string; revenue: number; pct: number }

// Receita das compras pagas agrupada por produto (maior → menor).
export async function getProductBreakdown(
  supabase: SupabaseClient,
  range?: DateRange,
  offerId?: string | null
): Promise<ProductSlice[]> {
  const { data } = await inRange(
    supabase.from('purchases').select('produto, valor').eq('status', 'paid'),
    range,
    offerId
  )
  const map = new Map<string, number>()
  for (const r of data ?? []) {
    const name = (r.produto ?? '').trim() || 'Sem nome'
    map.set(name, (map.get(name) ?? 0) + (Number(r.valor) || 0))
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0)
  return [...map.entries()]
    .map(([produto, revenue]) => ({
      produto,
      revenue,
      pct: total > 0 ? revenue / total : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
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
  range?: DateRange,
  offerId?: string | null
): Promise<ApprovalRate[]> {
  const { data } = await inRange(
    supabase.from('purchases').select('payment_method, status'),
    range,
    offerId
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
  range?: DateRange,
  offerId?: string | null
): Promise<RevenueStats> {
  const { data: paid } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'paid'),
    range,
    offerId
  )
  const revenue = (paid ?? []).reduce((s, r) => s + (Number(r.valor) || 0), 0)
  const paidCount = paid?.length ?? 0

  const { data: refunded } = await inRange(
    supabase
      .from('purchases')
      .select('valor')
      .in('status', ['refunded', 'chargedback']),
    range,
    offerId
  )
  const refundedAmount = (refunded ?? []).reduce(
    (s, r) => s + (Number(r.valor) || 0),
    0
  )

  // Pendentes: aguardando pagamento (Pix/boleto gerado, ainda não pago).
  const { data: pending } = await inRange(
    supabase.from('purchases').select('valor').eq('status', 'unpaid'),
    range,
    offerId
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
