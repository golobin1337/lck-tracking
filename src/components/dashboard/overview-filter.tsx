'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type PresetKey =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'day'
  | 'custom'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
]

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
// "YYYY-MM-DD" → Date no fuso local
function parseDay(v: string) {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function OverviewFilter({
  preset,
  from,
  to,
}: {
  preset: PresetKey
  from?: string
  to?: string
}) {
  const router = useRouter()
  const [specificDay, setSpecificDay] = React.useState('')
  const [customFrom, setCustomFrom] = React.useState('')
  const [customTo, setCustomTo] = React.useState('')

  // Inicializa os inputs com o range vindo da URL (quando aplicável).
  React.useEffect(() => {
    if (!from || !to) return
    const f = new Date(from)
    const t = new Date(to)
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    if (preset === 'day') setSpecificDay(iso(f))
    if (preset === 'custom') {
      setCustomFrom(iso(f))
      setCustomTo(iso(t))
    }
  }, [preset, from, to])

  function push(p: PresetKey, fromD: Date, toD: Date) {
    const tz = new Date().getTimezoneOffset()
    const params = new URLSearchParams({
      preset: p,
      from: fromD.toISOString(),
      to: toD.toISOString(),
      tz: String(tz),
    })
    router.push(`/dashboard?${params.toString()}`)
  }

  function applyPreset(p: PresetKey) {
    const now = new Date()
    if (p === 'today') return push(p, startOfDay(now), endOfDay(now))
    if (p === 'yesterday') {
      const y = new Date(now)
      y.setDate(now.getDate() - 1)
      return push(p, startOfDay(y), endOfDay(y))
    }
    if (p === '7d') {
      const s = new Date(now)
      s.setDate(now.getDate() - 6)
      return push(p, startOfDay(s), endOfDay(now))
    }
    // 30d
    const s = new Date(now)
    s.setDate(now.getDate() - 29)
    return push(p, startOfDay(s), endOfDay(now))
  }

  function applySpecific() {
    if (!specificDay) return
    const d = parseDay(specificDay)
    push('day', startOfDay(d), endOfDay(d))
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    let a = parseDay(customFrom)
    let b = parseDay(customTo)
    if (a > b) [a, b] = [b, a]
    push('custom', startOfDay(a), endOfDay(b))
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="h-6 w-px self-center bg-border max-sm:hidden" />

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="specific" className="text-xs">
            Específico
          </Label>
          <Input
            id="specific"
            type="date"
            value={specificDay}
            onChange={(e) => setSpecificDay(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <Button
          size="sm"
          variant={preset === 'day' ? 'default' : 'outline'}
          onClick={applySpecific}
        >
          Ver
        </Button>
      </div>

      <div className="h-6 w-px self-center bg-border max-sm:hidden" />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cfrom" className="text-xs">
            De
          </Label>
          <Input
            id="cfrom"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cto" className="text-xs">
            Até
          </Label>
          <Input
            id="cto"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <Button
          size="sm"
          variant={preset === 'custom' ? 'default' : 'outline'}
          onClick={applyCustom}
        >
          Aplicar
        </Button>
      </div>
    </div>
  )
}
