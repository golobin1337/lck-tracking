'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import type { CampaignNode } from '@/lib/meta-ads'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

function roasBadge(roas: number | null) {
  if (roas === null) return <span className="text-muted-foreground">—</span>
  const variant = roas >= 2 ? 'success' : roas >= 1 ? 'warning' : 'destructive'
  return <Badge variant={variant}>{roas.toFixed(2)}x</Badge>
}

export function CampaignsTree({ campaigns }: { campaigns: CampaignNode[] }) {
  const [openC, setOpenC] = React.useState<Set<string>>(new Set())
  const [openA, setOpenA] = React.useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  if (campaigns.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma campanha com dados no período.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Campanha / Conjunto / Anúncio</th>
            <th className="px-3 py-2 text-right font-medium">Investido</th>
            <th className="px-3 py-2 text-right font-medium">Impr.</th>
            <th className="px-3 py-2 text-right font-medium">Cliques</th>
            <th className="px-3 py-2 text-right font-medium">Receita</th>
            <th className="px-3 py-2 text-right font-medium">ROAS</th>
            <th className="px-3 py-2 text-right font-medium">CPA</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((camp) => {
            const cOpen = openC.has(camp.id)
            return (
              <React.Fragment key={camp.id}>
                <tr
                  className="cursor-pointer border-b border-border/60 hover:bg-secondary/40"
                  onClick={() => setOpenC((s) => toggle(s, camp.id))}
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ChevronRight
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          cOpen && 'rotate-90'
                        )}
                      />
                      {camp.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatCurrency(camp.spend)}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-muted-foreground">
                    {formatNumber(camp.impressions)}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-muted-foreground">
                    {formatNumber(camp.clicks)}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {camp.revenue > 0 ? formatCurrency(camp.revenue) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{roasBadge(camp.roas)}</td>
                  <td className="px-3 py-2 text-right tabular">
                    {camp.cpa !== null ? formatCurrency(camp.cpa) : '—'}
                  </td>
                </tr>

                {cOpen &&
                  camp.adsets.map((adset) => {
                    const aOpen = openA.has(adset.id)
                    return (
                      <React.Fragment key={adset.id}>
                        <tr
                          className="cursor-pointer border-b border-border/40 bg-background/30 hover:bg-secondary/30"
                          onClick={() => setOpenA((s) => toggle(s, adset.id))}
                        >
                          <td className="px-3 py-2 pl-8">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <ChevronRight
                                className={cn(
                                  'size-3.5 shrink-0 transition-transform',
                                  aOpen && 'rotate-90'
                                )}
                              />
                              {adset.name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular">
                            {formatCurrency(adset.spend)}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-muted-foreground">
                            {formatNumber(adset.impressions)}
                          </td>
                          <td className="px-3 py-2 text-right tabular text-muted-foreground">
                            {formatNumber(adset.clicks)}
                          </td>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2" />
                        </tr>

                        {aOpen &&
                          adset.ads.map((ad) => (
                            <tr
                              key={ad.id}
                              className="border-b border-border/30 text-muted-foreground"
                            >
                              <td className="px-3 py-1.5 pl-14 text-xs">
                                {ad.name}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular text-xs">
                                {formatCurrency(ad.spend)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular text-xs">
                                {formatNumber(ad.impressions)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular text-xs">
                                {formatNumber(ad.clicks)}
                              </td>
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5" />
                            </tr>
                          ))}
                      </React.Fragment>
                    )
                  })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
