import { Users, Activity, ShoppingCart, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const placeholderStats = [
  { label: 'Usuários únicos', value: '—', icon: Users, accent: 'text-primary' },
  { label: 'Eventos', value: '—', icon: Activity, accent: 'text-cyan' },
  { label: 'Compras', value: '—', icon: ShoppingCart, accent: 'text-amber' },
  {
    label: 'Taxa de conversão',
    value: '—',
    icon: TrendingUp,
    accent: 'text-primary',
  },
]

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo de visitantes, eventos e conversões."
      >
        <Badge variant="info">Dados na Fase 5</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {placeholderStats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <Icon className={`size-4 ${s.accent}`} />
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-semibold tabular">
                  {s.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          O funil (Visitou → Checkout → Compra) e os gráficos entram na Fase 5,
          quando os endpoints de captura já estiverem gravando dados.
        </CardContent>
      </Card>
    </>
  )
}
