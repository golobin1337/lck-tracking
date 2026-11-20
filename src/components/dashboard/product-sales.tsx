import type { ProductSlice } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 9
  const c = 2 * Math.PI * r
  const off = c * (1 - pct)
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" className="shrink-0">
      <circle
        cx={12}
        cy={12}
        r={r}
        fill="none"
        stroke="hsl(var(--secondary))"
        strokeWidth={3}
      />
      <circle
        cx={12}
        cy={12}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 12 12)"
      />
    </svg>
  )
}

export function ProductSales({ data }: { data: ProductSlice[] }) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem vendas no período.
      </p>
    )
  }
  const color = 'hsl(222 85% 58%)'
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div
          key={d.produto}
          className="flex items-center justify-between gap-3"
        >
          <span className="min-w-0 truncate text-sm" title={d.produto}>
            {d.produto}
          </span>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="tabular text-sm font-semibold">
              {formatCurrency(d.revenue)}
            </span>
            <Ring pct={d.pct} color={color} />
            <span className="tabular w-12 text-right text-xs text-muted-foreground">
              {(d.pct * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
