import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export type FlatCampaign = {
  id: string
  name: string
  status: string
  budget: number | null
  spend: number
  revenue: number
  sales: number
  clicks: number
  impressions: number
  reach: number
  video_views_3s: number
  thruplay: number
  ic: number
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'ACTIVE'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'bg-success/15 text-success'
          : 'bg-secondary text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-success' : 'bg-muted-foreground'
        )}
      />
      {active ? 'Ativo' : 'Pausado'}
    </span>
  )
}

function Money({ v, color }: { v: number; color?: boolean }) {
  return (
    <span
      className={cn(
        'tabular',
        color && (v >= 0 ? 'text-success' : 'text-destructive')
      )}
    >
      {formatCurrency(v)}
    </span>
  )
}

export function CampaignsFlat({
  rows,
  nameLabel = 'Campanha',
}: {
  rows: FlatCampaign[]
  nameLabel?: string
}) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum dado no período.
      </p>
    )
  }

  const sorted = [...rows].sort((a, b) => b.spend - a.spend)

  const t = sorted.reduce(
    (acc, r) => {
      acc.spend += r.spend
      acc.revenue += r.revenue
      acc.sales += r.sales
      acc.clicks += r.clicks
      acc.impressions += r.impressions
      acc.reach += r.reach
      acc.video_views_3s += r.video_views_3s
      acc.thruplay += r.thruplay
      acc.ic += r.ic
      acc.budget += r.budget ?? 0
      return acc
    },
    { spend: 0, revenue: 0, sales: 0, clicks: 0, impressions: 0, reach: 0, video_views_3s: 0, thruplay: 0, ic: 0, budget: 0 }
  )

  const roas = (rev: number, sp: number) => (sp > 0 ? rev / sp : null)
  const cpa = (sp: number, s: number) => (s > 0 ? sp / s : null)
  const cpc = (sp: number, c: number) => (c > 0 ? sp / c : null)
  const ctr = (c: number, imp: number) => (imp > 0 ? (c / imp) * 100 : null)
  const cpm = (sp: number, imp: number) => (imp > 0 ? (sp / imp) * 1000 : null)
  const hook = (v3s: number, imp: number) => (imp > 0 && v3s > 0 ? (v3s / imp) * 100 : null)
  const holdRate = (tp: number, v3s: number) => (v3s > 0 && tp > 0 ? (tp / v3s) * 100 : null)
  const freq = (imp: number, reach: number) => (reach > 0 ? imp / reach : null)
  const arpu = (rev: number, s: number) => (s > 0 ? rev / s : null)

  const Head = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground',
        right ? 'text-right' : 'text-left'
      )}
    >
      {children}
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <Head>Status</Head>
            <Head>{nameLabel}</Head>
            <Head right>CPC</Head>
            <Head right>CTR</Head>
            <Head right>CPM</Head>
            <Head right>Hook</Head>
            <Head right>Hold Rate</Head>
            <Head right>Frequência</Head>
            <Head right>Lucro</Head>
            <Head right>Gastos</Head>
            <Head right>Faturamento</Head>
            <Head right>Vendas</Head>
            <Head right>ROI</Head>
            <Head right>CPA</Head>
            <Head right>IC</Head>
            <Head right>Cliques</Head>
            <Head right>ARPU</Head>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const lucro = r.revenue - r.spend
            const ro = roas(r.revenue, r.spend)
            const ca = cpa(r.spend, r.sales)
            const cc = cpc(r.spend, r.clicks)
            const ct = ctr(r.clicks, r.impressions)
            const cm = cpm(r.spend, r.impressions)
            const hk = hook(r.video_views_3s, r.impressions)
            const hr = holdRate(r.thruplay, r.video_views_3s)
            const fr = freq(r.impressions, r.reach)
            const ar = arpu(r.revenue, r.sales)
            return (
              <tr
                key={r.id}
                className="border-b border-border/50 last:border-0 hover:bg-secondary/40"
              >
                <td className="px-3 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="max-w-[240px] truncate px-3 py-3" title={r.name}>
                  {r.name}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {cc !== null ? <Money v={cc} /> : '—'}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {ct !== null ? `${ct.toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {cm !== null ? <Money v={cm} /> : '—'}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {hk !== null ? `${hk.toFixed(2)}%` : 'N/A'}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {hr !== null ? `${hr.toFixed(2)}%` : 'N/A'}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {fr !== null ? fr.toFixed(2) : '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <Money v={lucro} color />
                </td>
                <td className="px-3 py-3 text-right">
                  <Money v={r.spend} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Money v={r.revenue} />
                </td>
                <td className="tabular px-3 py-3 text-right">{r.sales}</td>
                <td className="px-3 py-3 text-right">
                  {ro !== null ? (
                    <span
                      className={cn(
                        'tabular font-medium',
                        ro >= 1 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {ro.toFixed(2)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {ca !== null ? <Money v={ca} /> : '—'}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {r.ic}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted-foreground">
                  {formatNumber(r.clicks)}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {ar !== null ? <Money v={ar} /> : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-3 py-3" />
            <td className="px-3 py-3">
              {sorted.length} {nameLabel.toLowerCase()}s
            </td>
            <td className="px-3 py-3 text-right">
              {cpc(t.spend, t.clicks) !== null ? (
                <Money v={cpc(t.spend, t.clicks)!} />
              ) : (
                '—'
              )}
            </td>
            <td className="tabular px-3 py-3 text-right">
              {ctr(t.clicks, t.impressions) !== null
                ? `${ctr(t.clicks, t.impressions)!.toFixed(2)}%`
                : '—'}
            </td>
            <td className="px-3 py-3 text-right">
              {cpm(t.spend, t.impressions) !== null ? (
                <Money v={cpm(t.spend, t.impressions)!} />
              ) : (
                '—'
              )}
            </td>
            <td className="tabular px-3 py-3 text-right">
              {hook(t.video_views_3s, t.impressions) !== null
                ? `${hook(t.video_views_3s, t.impressions)!.toFixed(2)}%`
                : 'N/A'}
            </td>
            <td className="tabular px-3 py-3 text-right">
              {holdRate(t.thruplay, t.video_views_3s) !== null
                ? `${holdRate(t.thruplay, t.video_views_3s)!.toFixed(2)}%`
                : 'N/A'}
            </td>
            <td className="tabular px-3 py-3 text-right">
              {freq(t.impressions, t.reach) !== null
                ? freq(t.impressions, t.reach)!.toFixed(2)
                : '—'}
            </td>
            <td className="px-3 py-3 text-right">
              <Money v={t.revenue - t.spend} color />
            </td>
            <td className="px-3 py-3 text-right">
              <Money v={t.spend} />
            </td>
            <td className="px-3 py-3 text-right">
              <Money v={t.revenue} />
            </td>
            <td className="tabular px-3 py-3 text-right">{t.sales}</td>
            <td className="px-3 py-3 text-right">
              {roas(t.revenue, t.spend) !== null ? (
                <span className="tabular">
                  {roas(t.revenue, t.spend)!.toFixed(2)}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-3 py-3 text-right">
              {cpa(t.spend, t.sales) !== null ? (
                <Money v={cpa(t.spend, t.sales)!} />
              ) : (
                '—'
              )}
            </td>
            <td className="tabular px-3 py-3 text-right">{t.ic}</td>
            <td className="tabular px-3 py-3 text-right">
              {formatNumber(t.clicks)}
            </td>
            <td className="px-3 py-3 text-right">
              {arpu(t.revenue, t.sales) !== null ? (
                <Money v={arpu(t.revenue, t.sales)!} />
              ) : (
                '—'
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
