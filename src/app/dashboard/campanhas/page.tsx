import Link from 'next/link'
import { DollarSign, TrendingUp, Target, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOfferId } from '@/lib/offers'
import { getActiveAdAccounts } from '@/lib/destinations'
import { getRevenueByCampaign } from '@/lib/analytics'
import {
  fetchAdInsights,
  buildCampaignTree,
  type AdInsightRow,
  type DatePreset,
} from '@/lib/meta-ads'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import { CampaignsTree } from '@/components/dashboard/campaigns-tree'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

type SP = { account?: string; preset?: string; refresh?: string }

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
]

export default async function CampanhasPage(props: {
  searchParams: Promise<SP>
}) {
  const sp = await props.searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const offerId = await getCurrentOfferId()
  const accounts = user ? await getActiveAdAccounts(user.id, offerId) : []
  const preset = (sp.preset as DatePreset) || 'last_30d'
  const selected = sp.account && sp.account !== 'all' ? sp.account : 'all'
  const force = sp.refresh === '1'

  // Estado vazio: nenhuma conta configurada.
  if (accounts.length === 0) {
    return (
      <>
        <PageHeader
          title="Campanhas"
          description="Insights do Meta Ads cruzados com receita (ROAS e CPA)."
        />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conta de anúncio configurada. Adicione uma em{' '}
            <Link
              href="/dashboard/configuracoes"
              className="text-primary underline-offset-4 hover:underline"
            >
              Configurações
            </Link>{' '}
            (Fase 7).
          </CardContent>
        </Card>
      </>
    )
  }

  const toQuery =
    selected === 'all' ? accounts : accounts.filter((a) => a.id === selected)

  const revByCamp = await getRevenueByCampaign(supabase, offerId)

  const results = await Promise.all(
    toQuery.map((acc) =>
      fetchAdInsights(
        { id: acc.id, ad_account_id: acc.ad_account_id, token: acc.token },
        preset,
        force
      )
    )
  )
  let rows: AdInsightRow[] = []
  let fetchedAt = 0
  let error: string | null = null
  let allCached = true
  let throttled = false
  for (const r of results) {
    rows = rows.concat(r.rows)
    fetchedAt = Math.max(fetchedAt, r.fetchedAt)
    if (r.error) error = r.error
    allCached = allCached && r.cached
    throttled = throttled || r.throttled
  }

  const tree = buildCampaignTree(rows, revByCamp)
  const totalSpend = tree.reduce((s, c) => s + c.spend, 0)
  const totalRevenue = tree.reduce((s, c) => s + c.revenue, 0)
  const totalPurchases = tree.reduce((s, c) => s + c.purchases, 0)
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null
  const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : null

  const hrefWith = (patch: Partial<SP>) => {
    const params = new URLSearchParams()
    params.set('account', patch.account ?? selected)
    params.set('preset', patch.preset ?? preset)
    if (patch.refresh) params.set('refresh', '1')
    return `/dashboard/campanhas?${params.toString()}`
  }

  const lastUpdate = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Insights do Meta Ads cruzados com receita (ROAS e CPA)."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefWith({ refresh: '1' })}>
            <RefreshCw />
            Atualizar
          </Link>
        </Button>
      </PageHeader>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            {accounts.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account">Conta de anúncio</Label>
                <select
                  id="account"
                  name="account"
                  defaultValue={selected}
                  className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">Todas as contas</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preset">Período</Label>
              <select
                id="preset"
                name="preset"
                defaultValue={preset}
                className="h-10 rounded-md border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Aplicar</Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm">
            {/(blocked|5258005)/i.test(error) ? (
              <p className="text-destructive">
                <b>Acesso à Marketing API bloqueado pelo Facebook</b> (erro
                5258005). O login conectou suas contas, mas o <b>app</b> do
                Facebook não tem permissão de ler insights. Verifique no
                developers.facebook.com: a <b>Marketing API</b> adicionada, o app
                em modo que permita o acesso e o <i>Data Use Checkup</i> em dia.
              </p>
            ) : (
              <p className="text-destructive">
                Erro ao buscar o Meta Ads: {error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Investimento"
          value={formatCurrency(totalSpend)}
          icon={DollarSign}
          accent="text-amber"
        />
        <StatCard
          label="Receita atribuída"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          accent="text-success"
        />
        <StatCard
          label="ROAS"
          value={roas !== null ? `${roas.toFixed(2)}x` : '—'}
          icon={TrendingUp}
          accent="text-primary"
        />
        <StatCard
          label="CPA"
          value={cpa !== null ? formatCurrency(cpa) : '—'}
          icon={Target}
          accent="text-cyan"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Última atualização: {lastUpdate}
        {allCached && ' · em cache'}
        {throttled && ' · aguarde alguns minutos para atualizar de novo'}
        {' · '}cache de 30 min, rate limit conservador
      </p>

      <Card className="mt-3">
        <CardContent className="pt-5">
          <CampaignsTree campaigns={tree} />
        </CardContent>
      </Card>
    </>
  )
}
