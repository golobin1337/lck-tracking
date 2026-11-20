import Link from 'next/link'
import {
  DollarSign,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Megaphone,
  Banknote,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getRevenueStats,
  getPaymentBreakdown,
  getApprovalRates,
  getProductBreakdown,
  type DateRange,
} from '@/lib/analytics'
import {
  resolveRange,
  fmtRangeLabel,
  type RangeSP,
} from '@/lib/date-range'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { PaymentDonut } from '@/components/dashboard/payment-donut'
import { ApprovalRates } from '@/components/dashboard/approval-rates'
import { ProductSales } from '@/components/dashboard/product-sales'
import { OverviewFilter } from '@/components/dashboard/overview-filter'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  PurchasesTable,
  type PurchaseRow,
} from '@/components/dashboard/purchases-table'
import { getOwnerUserId } from '@/lib/owner'
import { getActiveAdAccounts } from '@/lib/destinations'
import { getAdSpendTotal } from '@/lib/meta-ads'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

const PAGE_SIZE = 50

// Gasto total em anúncios no período para o ROI. 0 se Meta não conectado.
async function getTotalAdSpend(range: DateRange): Promise<number> {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return 0
  const accounts = await getActiveAdAccounts(ownerId)
  if (!accounts.length) return 0
  const tz = range.tz ?? 0
  const localDate = (iso: string) =>
    new Date(new Date(iso).getTime() - tz * 60000).toISOString().slice(0, 10)
  try {
    return await getAdSpendTotal(
      accounts,
      localDate(range.from),
      localDate(range.to)
    )
  } catch {
    return 0
  }
}

type SP = RangeSP & {
  status?: string
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
  const { range, preset, isDefault } = resolveRange(sp)
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const supabase = await createClient()

  const [stats, payments, approval, products, adSpend] = await Promise.all([
    getRevenueStats(supabase, range),
    getPaymentBreakdown(supabase, range),
    getApprovalRates(supabase, range),
    getProductBreakdown(supabase, range),
    getTotalAdSpend(range),
  ])

  const profit = stats.revenue - adSpend
  const roiPct = adSpend > 0 ? (profit / adSpend) * 100 : null
  const roas = adSpend > 0 ? stats.revenue / adSpend : null
  const cpa =
    adSpend > 0 && stats.paidCount > 0 ? adSpend / stats.paidCount : null

  let query = supabase
    .from('purchases')
    .select(
      'id, created_at, transaction_id, produto, valor, moeda, status, payment_method, trck_user_id, match_type, utm_source, conversion_sent, webhook_raw, response_meta, response_ga4',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (sp.status) query = query.eq('status', sp.status)
  query = query.gte('created_at', range.from).lte('created_at', range.to)

  const fromIdx = (page - 1) * PAGE_SIZE
  query = query.range(fromIdx, fromIdx + PAGE_SIZE - 1)

  const { data, count } = await query
  const purchases = (data ?? []) as PurchaseRow[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Preserva período (+ status) nos links.
  function withParams(extra: Record<string, string>) {
    const params = new URLSearchParams()
    params.set('preset', preset)
    params.set('from', range.from)
    params.set('to', range.to)
    params.set('tz', String(range.tz ?? 0))
    if (sp.status) params.set('status', sp.status)
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return `/dashboard/faturamento?${params.toString()}`
  }
  const buildPageHref = (p: number) => withParams({ page: String(p) })
  const pendingHref = withParams({ status: 'unpaid', page: '1' })

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

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Gastos com anúncios"
          value={formatCurrency(adSpend)}
          icon={Megaphone}
          accent="text-amber"
          hint={adSpend > 0 ? 'investimento no período' : 'conecte o Meta Ads'}
        />
        <StatCard
          label="Lucro"
          value={formatCurrency(profit)}
          icon={Banknote}
          accent={profit >= 0 ? 'text-success' : 'text-destructive'}
          hint="receita − gastos com anúncios"
        />
        <StatCard
          label="CPA"
          value={cpa !== null ? formatCurrency(cpa) : 'N/A'}
          icon={Target}
          accent="text-cyan"
          hint={
            cpa !== null ? 'custo por venda paga' : 'depende do Meta Ads'
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            ROI (retorno sobre investimento)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roiPct !== null && roas !== null ? (
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground">ROI</p>
                <p
                  className={cn(
                    'tabular text-4xl font-bold',
                    roiPct >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {roiPct >= 0 ? '+' : ''}
                  {roiPct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className="tabular text-2xl font-semibold">
                  {roas.toFixed(2)}x
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="tabular text-lg font-semibold text-success">
                  {formatCurrency(stats.revenue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Investido</p>
                <p className="tabular text-lg font-semibold">
                  {formatCurrency(adSpend)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p
                  className={cn(
                    'tabular text-lg font-semibold',
                    profit >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {formatCurrency(profit)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do <b>Meta Ads</b> (Configurações → Login com
              Facebook) para calcular o ROI. Sem o investimento (gasto em
              anúncios), não dá pra medir o retorno. Sua receita no período é{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(stats.revenue)}
              </span>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas por pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentDonut data={payments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxa de aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalRates data={approval} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-4xl font-bold text-amber">
                {formatNumber(stats.pendingCount)}
              </span>
              <span className="text-sm text-muted-foreground">
                aguardando pagamento
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Valor em aberto:{' '}
              <span className="font-semibold text-foreground">
                {formatCurrency(stats.pendingAmount)}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pix/boleto gerados que ainda não foram pagos.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href={pendingHref}>Ver pendentes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Vendas por produto</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductSales data={products} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 mt-4">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <OverviewFilter
                preset={preset}
                from={range.from}
                to={range.to}
                basePath="/dashboard/faturamento"
                autoToday={isDefault}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Período:{' '}
                <span className="text-foreground">{fmtRangeLabel(range)}</span>
              </p>
            </div>

            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="preset" value={preset} />
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
              <input type="hidden" name="tz" value={String(range.tz ?? 0)} />
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
              <Button type="submit">Filtrar</Button>
            </form>
          </div>
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
