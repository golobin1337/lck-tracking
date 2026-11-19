import { formatNumber } from '@/lib/utils'
import type { FunnelStage } from '@/lib/analytics'

// Funil horizontal com formato suave e gradiente (estilo Meta Ads).
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const n = stages.length
  if (n === 0) return null

  // Base das porcentagens: a 1ª etapa (Cliques); se estiver 0 (ex.: token do
  // Meta bloqueado), cai para a 1ª etapa não-zero para o funil seguir legível.
  const base = stages[0].value || stages.find((s) => s.value > 0)?.value || 0
  const maxVal = Math.max(...stages.map((s) => s.value), 1)

  const W = 1000
  const H = 200
  const cy = H / 2
  const maxHH = 86
  const minHH = 10

  const hh = stages.map((s) => {
    const ratio = s.value / maxVal
    return Math.max(minHH, ratio * maxHH)
  })
  // pontos de amostragem no centro de cada coluna
  const xs = stages.map((_, i) => ((i + 0.5) * W) / n)

  const top = (i: number) => cy - hh[i]
  const bot = (i: number) => cy + hh[i]

  // caminho suave (tangentes horizontais em cada ponto)
  let d = `M 0 ${top(0)} L ${xs[0]} ${top(0)}`
  for (let i = 1; i < n; i++) {
    const mid = (xs[i - 1] + xs[i]) / 2
    d += ` C ${mid} ${top(i - 1)}, ${mid} ${top(i)}, ${xs[i]} ${top(i)}`
  }
  d += ` L ${W} ${top(n - 1)} L ${W} ${bot(n - 1)} L ${xs[n - 1]} ${bot(n - 1)}`
  for (let i = n - 1; i > 0; i--) {
    const mid = (xs[i] + xs[i - 1]) / 2
    d += ` C ${mid} ${bot(i)}, ${mid} ${bot(i - 1)}, ${xs[i - 1]} ${bot(i - 1)}`
  }
  d += ` L 0 ${bot(0)} Z`

  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  const pctOf = (v: number) => (base > 0 ? (v / base) * 100 : 0)

  return (
    <div>
      {/* Rótulos */}
      <div className="grid" style={cols}>
        {stages.map((s, i) => (
          <div
            key={s.label}
            className={`px-2 py-1 text-center text-xs font-medium text-muted-foreground ${
              i > 0 ? 'border-l border-border/60' : ''
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* Corpo com o formato do funil */}
      <div className="relative h-44">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="funnelGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(222 85% 58%)" />
              <stop offset="50%" stopColor="hsl(262 80% 62%)" />
              <stop offset="100%" stopColor="hsl(300 75% 56%)" />
            </linearGradient>
          </defs>
          <path d={d} fill="url(#funnelGrad)" />
        </svg>

        {/* % centrado em cada coluna */}
        <div className="absolute inset-0 grid items-center" style={cols}>
          {stages.map((s, i) => (
            <div
              key={s.label}
              className={`px-1 text-center ${
                i > 0 ? 'border-l border-border/40' : ''
              }`}
            >
              <span className="tabular text-sm font-bold text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.55)]">
                {pctOf(s.value).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Contagens */}
      <div className="grid" style={cols}>
        {stages.map((s, i) => (
          <div
            key={s.label}
            className={`px-2 py-1 text-center ${
              i > 0 ? 'border-l border-border/60' : ''
            }`}
          >
            <span className="tabular text-sm font-semibold">
              {formatNumber(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
