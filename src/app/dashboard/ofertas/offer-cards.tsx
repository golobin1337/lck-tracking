'use client'

import { formatCurrency, cn } from '@/lib/utils'

export type OfferCardData = {
  id: string
  name: string
  slug: string
  revenue: number
  spend: number
  lucro: number
  roi: number | null
  spark: { day: string; value: number }[]
}

function Sparkline({ data }: { data: { day: string; value: number }[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map((d) => d.value), 1)
  const w = 200
  const h = 48
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (d.value / max) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-success"
      />
      <circle
        cx={String((data.length - 1) / (data.length - 1) * w)}
        cy={String(h - (data[data.length - 1].value / max) * (h - 4) - 2)}
        r="3"
        className="fill-success"
      />
    </svg>
  )
}

function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular w-24 shrink-0 text-right text-xs text-muted-foreground">
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function OfferCards({ cards }: { cards: OfferCardData[] }) {
  if (cards.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma oferta cadastrada.
      </p>
    )
  }

  const globalMax = Math.max(...cards.map((c) => Math.max(c.revenue, c.spend)), 1)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            'group relative overflow-hidden rounded-xl border p-5 transition-colors',
            card.lucro > 0
              ? 'border-success/30 bg-success/[0.03]'
              : 'border-border bg-card/60'
          )}
        >
          {/* Header */}
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold">{card.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                ROI
              </span>
              <p
                className={cn(
                  'tabular text-xl font-bold',
                  card.roi !== null && card.roi >= 1
                    ? 'text-success'
                    : card.roi !== null
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {card.roi !== null ? `${card.roi.toFixed(2)}x` : '—'}
              </p>
            </div>
          </div>

          {/* Lucro + Sparkline */}
          <div className="mb-4">
            <span className="text-xs text-muted-foreground">Lucro</span>
            <div className="flex items-end gap-4">
              <p
                className={cn(
                  'tabular text-2xl font-bold',
                  card.lucro >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {formatCurrency(card.lucro)}
              </p>
              <div className="flex-1">
                <Sparkline data={card.spark} />
              </div>
            </div>
          </div>

          {/* Barras */}
          <div className="space-y-2">
            <ProgressBar
              label="Faturamento"
              value={card.revenue}
              max={globalMax}
              color="bg-success"
            />
            <ProgressBar
              label="Investimento"
              value={card.spend}
              max={globalMax}
              color="bg-muted-foreground"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
