import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export type FlatCampaign = {
  id: string
  name: string
  spend: number
  revenue: number
  sales: number
  clicks: number
  ic: number
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

export function CampaignsFlat({ rows }: { rows: FlatCampaign[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma campanha com dados no período.
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
      acc.ic += r.ic
      return acc
    },
    { spend: 0, revenue: 0, sales: 0, clicks: 0, ic: 0 }
  )

  const roas = (rev: number, sp: number) => (sp > 0 ? rev / sp : null)
  const cpa = (sp: number, s: number) => (s > 0 ? sp / s : null)
  const cpc = (sp: number, c: number) => (c > 0 ? sp / c : null)

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
            <Head>Campanha</Head>
            <Head right>Lucro</Head>
            <Head right>Gastos</Head>
            <Head right>Faturamento</Head>
            <Head right>Vendas</Head>
            <Head right>ROI</Head>
            <Head right>CPA</Head>
            <Head right>IC</Head>
            <Head right>Cliques</Head>
            <Head right>CPC</Head>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const lucro = r.revenue - r.spend
            const ro = roas(r.revenue, r.spend)
            const ca = cpa(r.spend, r.sales)
            const cc = cpc(r.spend, r.clicks)
            return (
              <tr
                key={r.id}
                className="border-b border-border/50 last:border-0 hover:bg-secondary/40"
              >
                <td className="max-w-[260px] truncate px-3 py-3" title={r.name}>
                  {r.name}
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
                  {cc !== null ? <Money v={cc} /> : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-3 py-3">{sorted.length} campanhas</td>
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
              {cpc(t.spend, t.clicks) !== null ? (
                <Money v={cpc(t.spend, t.clicks)!} />
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
