import { formatNumber } from '@/lib/utils'

type Step = { label: string; value: number; color: string }

function pct(n: number, base: number): string {
  if (base <= 0) return '—'
  return `${((n / base) * 100).toFixed(1)}%`
}

export function Funnel({
  visited,
  checkout,
  purchased,
}: {
  visited: number
  checkout: number
  purchased: number
}) {
  const steps: Step[] = [
    { label: 'Visitou', value: visited, color: 'bg-primary' },
    { label: 'Checkout', value: checkout, color: 'bg-cyan' },
    { label: 'Compra', value: purchased, color: 'bg-success' },
  ]
  const max = Math.max(visited, 1)

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].value : null
        const widthPct = Math.max((step.value / max) * 100, 2)
        return (
          <div key={step.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="flex items-center gap-2">
                <span className="tabular font-semibold">
                  {formatNumber(step.value)}
                </span>
                {prev !== null && (
                  <span className="text-xs text-muted-foreground">
                    {pct(step.value, prev)} da etapa anterior
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${step.color}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
