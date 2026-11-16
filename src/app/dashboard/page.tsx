import { Users, Activity, ShoppingCart, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getOverviewStats,
  getEventsPerDay,
} from '@/lib/analytics'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { FunnelChart } from '@/components/dashboard/funnel-chart'
import { EventsChart } from '@/components/dashboard/events-chart'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const [stats, perDay] = await Promise.all([
    getOverviewStats(supabase),
    getEventsPerDay(supabase, 30),
  ])

  const conversionPct = `${(stats.conversionRate * 100).toFixed(2)}%`

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo de visitantes, eventos e conversões."
      />

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
            Visitantes → Visualizações → Checkout → Vendas
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
    </>
  )
}
