import { Users, Activity, ShoppingCart, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getOverviewStats,
  getEventsPerDay,
  getGeoBreakdown,
  type DateRange,
} from '@/lib/analytics'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { EventsChart } from '@/components/dashboard/events-chart'
import { GeoSection } from '@/components/dashboard/geo-section'
import { OverviewFilter } from '@/components/dashboard/overview-filter'
import {
  resolveRange,
  fmtRangeLabel,
  type RangeSP,
} from '@/lib/date-range'
import { getOwnerUserId } from '@/lib/owner'
import { getCurrentOfferId } from '@/lib/offers'
import { getActiveAdAccounts } from '@/lib/destinations'
import { getAdClicksTotal } from '@/lib/meta-ads'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Total de cliques reais do Meta Ads no período (0 se sem conta/ token bloqueado).
async function getAdClicks(
  range: DateRange,
  offerId: string | null
): Promise<number> {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return 0
  const accounts = await getActiveAdAccounts(ownerId, offerId)
  if (!accounts.length) return 0
  const tz = range.tz ?? 0
  const localDate = (iso: string) =>
    new Date(new Date(iso).getTime() - tz * 60000).toISOString().slice(0, 10)
  try {
    return await getAdClicksTotal(accounts, localDate(range.from), localDate(range.to))
  } catch {
    return 0
  }
}

export default async function DashboardPage(props: {
  searchParams: Promise<RangeSP>
}) {
  const sp = await props.searchParams
  const { range, preset, isDefault } = resolveRange(sp)
  const offerId = await getCurrentOfferId()

  const supabase = await createClient()
  const adClicks = await getAdClicks(range, offerId)
  const [stats, perDay, geo] = await Promise.all([
    getOverviewStats(supabase, range, adClicks, offerId),
    getEventsPerDay(supabase, range, offerId),
    getGeoBreakdown(supabase, range, offerId),
  ])

  const conversionPct = `${(stats.conversionRate * 100).toFixed(2)}%`

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo de visitantes, eventos e conversões."
      />

      <div className="mb-4">
        <OverviewFilter
          preset={preset}
          from={range.from}
          to={range.to}
          autoToday={isDefault}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Período: <span className="text-foreground">{fmtRangeLabel(range)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários únicos"
          value={formatNumber(stats.uniqueVisitors)}
          icon={Users}
          accent="text-primary"
        />
        <StatCard
          label="Eventos"
          value={formatNumber(stats.totalEvents)}
          icon={Activity}
          accent="text-cyan"
        />
        <StatCard
          label="Compras"
          value={formatNumber(stats.paidPurchases)}
          icon={ShoppingCart}
          accent="text-success"
          hint={formatCurrency(stats.revenue)}
        />
        <StatCard
          label="Taxa de conversão"
          value={conversionPct}
          icon={TrendingUp}
          accent="text-amber"
          hint="compras ÷ visitantes"
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Funil de conversão</CardTitle>
          <CardDescription>
            Cliques → Visitas → Checkout → Vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FunnelChart stages={stats.funnel} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Eventos por dia</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <EventsChart data={perDay} />
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-1 text-base font-semibold">Geolocalização</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {formatNumber(geo.located)} de {formatNumber(geo.total)} visitantes
          localizados pelo IP.
        </p>
        <GeoSection geo={geo} />
      </div>
    </>
  )
}
