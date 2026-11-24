import Link from 'next/link'
import { DollarSign, TrendingUp, Target, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOfferId } from '@/lib/offers'
import { getActiveAdAccounts } from '@/lib/destinations'
import { getRevenueByMetaId, getCheckoutByMetaId } from '@/lib/analytics'
import {
  fetchAdInsights,
  getCampaignMeta,
  type AdInsightRow,
  type DatePreset,
} from '@/lib/meta-ads'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard } from '@/components/dashboard/stat-card'
import {
  CampaignsFlat,
  type FlatCampaign,
} from '@/components/dashboard/campaigns-flat'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

type SP = {
  account?: string
  preset?: string
  refresh?: string
  q?: string
  level?: string
}

type Level = 'account' | 'campaign' | 'adset' | 'ad'
const LEVELS: { value: Level; label: string; column: 'utm_campaign' | 'utm_medium' | 'utm_content' }[] = [
  { value: 'account', label: 'Contas', column: 'utm_campaign' },
  { value: 'campaign', label: 'Campanhas', column: 'utm_campaign' },
  { value: 'adset', label: 'Conjuntos', column: 'utm_medium' },
  { value: 'ad', label: 'Anúncios', column: 'utm_content' },
]

// Converte o date_preset do Meta num intervalo de datas (BRT, UTC-3) para
// filtrar a receita/vendas e alinhar com o gasto do período.
const BRT = 180
function presetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const local = new Date(now.getTime() - BRT * 60000)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  const startOf = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm, dd) + BRT * 60000)
  const endOf = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm, dd, 23, 59, 59, 999) + BRT * 60000)
  let from: Date
  let to: Date = now
  switch (preset) {
    case 'today':
      from = startOf(y, m, d)
      break
    case 'yesterday':
      from = startOf(y, m, d - 1)
      to = endOf(y, m, d - 1)
      break
    case 'last_7d':
      from = startOf(y, m, d - 6)
      break
    case 'last_14d':
      from = startOf(y, m, d - 13)
      break
    case 'this_month':
      from = startOf(y, m, 1)
      break
    case 'last_month':
      from = startOf(y, m - 1, 1)
      to = endOf(y, m, 0)
      break
    default: // last_30d
      from = startOf(y, m, d - 29)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

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
  const levelCfg =
    LEVELS.find((l) => l.value === sp.level) ?? LEVELS[0]
  const level = levelCfg.value

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

  const range = presetRange(preset)

  const revColumn = level === 'account' ? 'utm_campaign' : levelCfg.column
  const [revById, icById, paidCountRes] = await Promise.all([
    getRevenueByMetaId(supabase, revColumn, offerId, range),
    getCheckoutByMetaId(supabase, revColumn, offerId, range),
    (() => {
      let q = supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid')
        .gte('created_at', range.from)
        .lte('created_at', range.to)
      if (offerId) q = q.eq('offer_id', offerId)
      return q
    })(),
  ])

  const [results, campMeta] = await Promise.all([
    Promise.all(
      toQuery.map((acc) =>
        fetchAdInsights(
          { id: acc.id, ad_account_id: acc.ad_account_id, token: acc.token },
          preset,
          force
        )
      )
    ),
    getCampaignMeta(
      toQuery.map((a) => ({
        id: a.id,
        ad_account_id: a.ad_account_id,
        token: a.token,
      }))
    ),
  ])

  let fetchedAt = 0
  let error: string | null = null
  let allCached = true
  let throttled = false
  for (const r of results) {
    fetchedAt = Math.max(fetchedAt, r.fetchedAt)
    if (r.error) error = r.error
    allCached = allCached && r.cached
    throttled = throttled || r.throttled
  }

  let flatRows: FlatCampaign[]

  // Mapa entity_id → accountId (DB id) para o toggle saber qual token usar.
  const entityAccount = new Map<string, string>()
  for (let i = 0; i < toQuery.length; i++) {
    for (const r of results[i].rows) {
      if (!entityAccount.has(r.campaign_id)) entityAccount.set(r.campaign_id, toQuery[i].id)
      if (!entityAccount.has(r.adset_id)) entityAccount.set(r.adset_id, toQuery[i].id)
      if (!entityAccount.has(r.ad_id)) entityAccount.set(r.ad_id, toQuery[i].id)
    }
  }

  if (level === 'account') {
    flatRows = toQuery.map((acc, i) => {
      const accRows = results[i].rows
      const spend = accRows.reduce((s, r) => s + r.spend, 0)
      const clicks = accRows.reduce((s, r) => s + r.clicks, 0)
      const impressions = accRows.reduce((s, r) => s + r.impressions, 0)
      const reach = accRows.reduce((s, r) => s + r.reach, 0)
      const video_views_3s = accRows.reduce((s, r) => s + r.video_views_3s, 0)
      const thruplay = accRows.reduce((s, r) => s + r.thruplay, 0)
      const campIds = new Set(accRows.map((r) => r.campaign_id))
      let revenue = 0
      let sales = 0
      let ic = 0
      for (const cid of campIds) {
        const rev = revById.get(cid)
        if (rev) { revenue += rev.revenue; sales += rev.count }
        ic += icById.get(cid) ?? 0
      }
      return {
        id: acc.id,
        name: acc.label,
        status: '',
        budget: null,
        spend, clicks, impressions, reach, video_views_3s, thruplay,
        revenue, sales, ic,
        accountId: acc.id,
      }
    })
  } else {
    const allRows: AdInsightRow[] = results.flatMap((r) => r.rows)
    const groups = new Map<
      string,
      { id: string; name: string; spend: number; clicks: number; impressions: number; reach: number; video_views_3s: number; thruplay: number }
    >()
    for (const r of allRows) {
      const id =
        level === 'campaign'
          ? r.campaign_id
          : level === 'adset'
            ? r.adset_id
            : r.ad_id
      const name =
        level === 'campaign'
          ? r.campaign_name
          : level === 'adset'
            ? r.adset_name
            : r.ad_name
      if (!id) continue
      const e = groups.get(id) ?? { id, name, spend: 0, clicks: 0, impressions: 0, reach: 0, video_views_3s: 0, thruplay: 0 }
      e.spend += r.spend
      e.clicks += r.clicks
      e.impressions += r.impressions
      e.reach += r.reach
      e.video_views_3s += r.video_views_3s
      e.thruplay += r.thruplay
      groups.set(id, e)
    }

    flatRows = [...groups.values()].map((g) => {
      const rev = revById.get(g.id)
      return {
        id: g.id,
        name: g.name,
        status: campMeta[g.id]?.status ?? '',
        budget: level === 'campaign' ? campMeta[g.id]?.budget ?? null : null,
        spend: g.spend,
        clicks: g.clicks,
        impressions: g.impressions,
        reach: g.reach,
        video_views_3s: g.video_views_3s,
        thruplay: g.thruplay,
        revenue: rev?.revenue ?? 0,
        sales: rev?.count ?? 0,
        ic: icById.get(g.id) ?? 0,
        accountId: entityAccount.get(g.id) ?? '',
      }
    })
  }
  const q = (sp.q ?? '').trim().toLowerCase()
  if (q) flatRows = flatRows.filter((r) => r.name.toLowerCase().includes(q))

  const totalSpend = flatRows.reduce((s, r) => s + r.spend, 0)
  const totalRevenue = flatRows.reduce((s, r) => s + r.revenue, 0)
  const totalSales = flatRows.reduce((s, r) => s + r.sales, 0)
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null
  const cpa = totalSales > 0 ? totalSpend / totalSales : null
  const untracked = Math.max(0, (paidCountRes.count ?? 0) - totalSales)

  const hrefWith = (patch: Partial<SP>) => {
    const params = new URLSearchParams()
    params.set('account', patch.account ?? selected)
    params.set('preset', patch.preset ?? preset)
    params.set('level', patch.level ?? level)
    if (sp.q) params.set('q', sp.q)
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
        {untracked > 0 && (
          <span className="rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1 text-xs font-medium text-amber">
            {untracked} venda(s) não trackeada(s)
          </span>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={hrefWith({ refresh: '1' })}>
            <RefreshCw />
            Atualizar
          </Link>
        </Button>
      </PageHeader>

      {/* Abas por nível */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {LEVELS.map((l) => (
          <Link
            key={l.value}
            href={hrefWith({ level: l.value })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              level === l.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input type="hidden" name="level" value={level} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q">{levelCfg.label.slice(0, -1)}</Label>
              <Input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Filtrar por nome"
                className="w-48"
              />
            </div>
            {accounts.length > 1 && level !== 'account' && (
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
          <CampaignsFlat rows={flatRows} nameLabel={levelCfg.label.slice(0, -1)} />
        </CardContent>
      </Card>
    </>
  )
}
