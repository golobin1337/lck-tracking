'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type PresetKey =
  | 'max'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'day'
  | 'custom'

const LABELS: Record<PresetKey, string> = {
  max: 'Máximo',
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  this_month: 'Esse mês',
  last_month: 'Mês passado',
  day: 'Dia específico',
  custom: 'Personalizado',
}

// Ordem no menu.
const MENU: PresetKey[] = [
  'max',
  'today',
  'yesterday',
  '7d',
  '30d',
  'this_month',
  'last_month',
  'day',
  'custom',
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
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<PresetKey>(preset)
  const [specificDay, setSpecificDay] = React.useState('')
  const [customFrom, setCustomFrom] = React.useState('')
  const [customTo, setCustomTo] = React.useState('')
  const wrapRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setMode(preset), [preset])

  // Inicializa inputs com o range vindo da URL.
  React.useEffect(() => {
    if (!from || !to) return
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    if (preset === 'day') setSpecificDay(iso(new Date(from)))
    if (preset === 'custom') {
      setCustomFrom(iso(new Date(from)))
      setCustomTo(iso(new Date(to)))
    }
  }, [preset, from, to])

  // Fecha o menu ao clicar fora.
  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

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
    if (p === 'max') {
      return push(p, new Date(2020, 0, 1), endOfDay(now))
    }
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
    if (p === '30d') {
      const s = new Date(now)
      s.setDate(now.getDate() - 29)
      return push(p, startOfDay(s), endOfDay(now))
    }
    if (p === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return push(p, startOfDay(s), endOfDay(now))
    }
    // last_month
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 0)
    return push(p, startOfDay(s), endOfDay(e))
  }

  function onSelect(p: PresetKey) {
    setOpen(false)
    if (p === 'day' || p === 'custom') {
      setMode(p) // mostra os inputs; aplica depois
    } else {
      setMode(p)
      applyPreset(p)
    }
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {/* Dropdown */}
      <div className="relative" ref={wrapRef}>
        <Label className="mb-1 block text-xs text-muted-foreground">
          Período de visualização
        </Label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-56 items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 text-sm transition-colors hover:bg-secondary/50"
        >
          <span className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            {LABELS[mode]}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
            {MENU.map((key) => {
              const active = mode === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-secondary'
                  }`}
                >
                  {LABELS[key]}
                  {active && <Check className="size-4" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Dia específico */}
      {mode === 'day' && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="specific" className="text-xs">
              Dia
            </Label>
            <Input
              id="specific"
              type="date"
              value={specificDay}
              onChange={(e) => setSpecificDay(e.target.value)}
              className="h-10 w-40"
            />
          </div>
          <Button onClick={applySpecific} disabled={!specificDay}>
            Ver
          </Button>
        </div>
      )}

      {/* Personalizado */}
      {mode === 'custom' && (
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
              className="h-10 w-40"
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
              className="h-10 w-40"
            />
          </div>
          <Button onClick={applyCustom} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  )
}
