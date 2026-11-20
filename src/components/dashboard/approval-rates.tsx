import type { ApprovalRate } from '@/lib/analytics'

function Ring({ pct, color }: { pct: number | null; color: string }) {
  const r = 9
  const c = 2 * Math.PI * r
  const p = pct ?? 0
  const off = c * (1 - p)
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
      {pct !== null && (
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
      )}
    </svg>
  )
}

export function ApprovalRates({ data }: { data: ApprovalRate[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.key} className="flex items-center justify-between gap-3">
          <span className="text-sm">{d.label}</span>
          <div className="flex items-center gap-2.5">
            <Ring pct={d.rate} color={d.color} />
            <span className="tabular w-14 text-right text-sm font-semibold">
              {d.rate === null ? (
                <span className="text-muted-foreground">N/A</span>
              ) : (
                `${(d.rate * 100).toFixed(1)}%`
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
