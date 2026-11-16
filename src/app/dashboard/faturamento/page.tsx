import Link from 'next/link'
import { DollarSign, Receipt, RotateCcw, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getRevenueStats } from '@/lib/analytics'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  PurchasesTable,
  type PurchaseRow,
} from '@/components/dashboard/purchases-table'
import { formatCurrency, formatNumber } from '@/lib/utils'

const PAGE_SIZE = 50

type SP = {
  status?: string
  from?: string
  to?: string
  page?: string
}

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'unpaid', label: 'Aguardando' },
  { value: 'refunded', label: 'Reembolso' },
  { value: 'chargedback', label: 'Chargeback' },
  { value: 'credit_card_declined', label: 'Recusado' },
]

export default async function FaturamentoPage(props: {
  searchParams: Promise<SP>
}) {
  const sp = await props.searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const supabase = await createClient()

  const stats = await getRevenueStats(supabase)

  let query = supabase
    .from('purchases')
    .select(
      'id, created_at, transaction_id, produto, valor, moeda, status, payment_method, trck_user_id, match_type, utm_source, conversion_sent, webhook_raw, response_meta, response_ga4',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (sp.status) query = query.eq('status', sp.status)
  if (sp.from) query = query.gte('created_at', `${sp.from}T00:00:00`)
  if (sp.to) query = query.lte('created_at', `${sp.to}T23:59:59`)

  const fromIdx = (page - 1) * PAGE_SIZE
  query = query.range(fromIdx, fromIdx + PAGE_SIZE - 1)

  const { data, count } = await query
  const purchases = (data ?? []) as PurchaseRow[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams()
    if (sp.status) params.set('status', sp.status)
    if (sp.from) params.set('from', sp.from)
    if (sp.to) params.set('to', sp.to)
    params.set('page', String(p))
    return `/dashboard/faturamento?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        title="Faturamento"
        description="Receita, ticket médio, reembolsos e compras."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita"
          value={formatCurrency(stats.revenue)}
          icon={DollarSign}
          accent="text-success"
        />
        <StatCard
          label="Ticket médio"
          value={formatCurrency(stats.avgTicket)}
          icon={Receipt}
          accent="text-primary"
        />
        <StatCard
          label="Compras pagas"
          value={formatNumber(stats.paidCount)}
          icon={ShoppingCart}
          accent="text-cyan"
        />
        <StatCard
          label="Reembolsos"
          value={formatNumber(stats.refundedCount)}
          icon={RotateCcw}
          accent="text-destructive"
          hint={formatCurrency(stats.refundedAmount)}
        />
      </div>

      <Card className="mb-4 mt-6">
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={sp.status ?? ''}
                className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">De</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={sp.from}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">Até</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={sp.to}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filtrar</Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/dashboard/faturamento">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <PurchasesTable purchases={purchases} />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(Math.max(1, page - 1))}>Anterior</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(Math.min(totalPages, page + 1))}>
                Próxima
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
