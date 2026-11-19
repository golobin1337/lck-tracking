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
import {
  OverviewFilter,
  type PresetKey,
} from '@/components/dashboard/overview-filter'
import { getOwnerUserId } from '@/lib/owner'
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

type SP = {
  preset?: string
  from?: string
  to?: string
  tz?: string
}

const PRESETS: PresetKey[] = ['today', 'yesterday', '7d', '30d', 'day', 'custom']

function resolveRange(sp: SP): { range: DateRange; preset: PresetKey } {
  const preset = (PRESETS as string[]).includes(sp.preset ?? '')
    ? (sp.preset as PresetKey)
    : '30d'
  const tz = Number(sp.tz)
  if (sp.from && sp.to) {
    return {
      range: {
        from: sp.from,
        to: sp.to,
        tz: Number.isFinite(tz) ? tz : 0,
      },
      preset,
    }
  }
  // Padrão: últimos 30 dias (UTC).
  const now = new Date()
  const from = new Date(now.getTime() - 29 * 864e5)
  from.setUTCHours(0, 0, 0, 0)
  return {
    range: { from: from.toISOString(), to: now.toISOString(), tz: 0 },
    preset: '30d',
  }
}

// Total de cliques reais do Meta Ads no período (0 se sem conta/ token bloqueado).
async function getAdClicks(range: DateRange): Promise<number> {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return 0
  const accounts = await getActiveAdAccounts(ownerId)
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

function fmtRangeLabel(range: DateRange): string {
  const opt: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }
  const a = new Date(range.from).toLocaleDateString('pt-BR', opt)
  const b = new Date(range.to).toLocaleDateString('pt-BR', opt)
  return a === b ? a : `${a} – ${b}`
}

export default async function DashboardPage(props: {
  searchParams: Promise<SP>
}) {
  const sp = await props.searchParams
  const { range, preset } = resolveRange(sp)

  const supabase = await createClient()
  const adClicks = await getAdClicks(range)
  const [stats, perDay, geo] = await Promise.all([
    getOverviewStats(supabase, range, adClicks),
    getEventsPerDay(supabase, range),
    getGeoBreakdown(supabase, range),
  ])

  const conversionPct = `${(stats.conversionRate * 100).toFixed(2)}%`

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo de visitantes, eventos e conversões."
      />

      <div className="mb-4">
        <OverviewFilter preset={preset} from={range.from} to={range.to} />
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
