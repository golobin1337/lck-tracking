'use client'

import * as React from 'react'
import { Trophy, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Níveis de premiação (R$). O primeiro é 100 mil; sobe sozinho ao bater a meta.
const TIERS = [
  100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
]

function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000
    return `R$ ${m.toFixed(m % 1 === 0 ? 0 : 1).replace('.', ',')}M`
  }
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function PrizeBadge() {
  const [revenue, setRevenue] = React.useState<number | null>(null)

  React.useEffect(() => {
    let active = true
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('purchases')
        .select('valor')
        .eq('status', 'paid')
      if (!active) return
      const total = (data ?? []).reduce(
        (s, r) => s + (Number(r.valor) || 0),
        0
      )
      setRevenue(total)
    }
    load()
    const t = setInterval(load, 60_000) // atualiza a cada 1 min
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  const cur = revenue ?? 0
  const target = TIERS.find((t) => cur < t) ?? TIERS[TIERS.length - 1]
  const pct = Math.min(100, (cur / target) * 100)

  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-40">
      <div
        className="flex items-center gap-3 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur-xl"
        title="Premiação por faturamento total (pago) das ofertas"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber">
          <Trophy className="size-4" />
        </span>
        <div className="min-w-[9rem]">
          <div className="flex items-center gap-1 text-xs font-semibold">
            Prêmios
            <Info className="size-3 text-muted-foreground" />
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber to-destructive transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] tabular text-muted-foreground">
            <span className="font-semibold text-foreground">
              {fmtCompact(cur)}
            </span>{' '}
            / {fmtCompact(target)}
          </div>
        </div>
      </div>
    </div>
  )
}
