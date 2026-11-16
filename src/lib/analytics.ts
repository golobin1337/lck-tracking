import type { SupabaseClient } from '@supabase/supabase-js'

// Todas as consultas rodam via RLS (cliente autenticado do dono).

export type OverviewStats = {
  uniqueVisitors: number
  totalEvents: number
  paidPurchases: number
  revenue: number
  conversionRate: number // 0..1
  funnel: { visited: number; checkout: number; purchased: number }
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

  // Funil: checkout = eventos InitiateCheckout (trck distintos).
  const { data: checkoutEvents } = await supabase
    .from('events_log')
    .select('trck_user_id')
    .eq('event_name', 'InitiateCheckout')
  const checkout = new Set(
    (checkoutEvents ?? [])
      .map((e) => e.trck_user_id)
      .filter((t): t is string => !!t)
  ).size

  const conversionRate =
    uniqueVisitors > 0 ? paidPurchases / uniqueVisitors : 0

  return {
    uniqueVisitors,
    totalEvents,
    paidPurchases,
    revenue,
    conversionRate,
    funnel: {
      visited: uniqueVisitors,
      checkout,
      purchased: paidPurchases,
    },
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
