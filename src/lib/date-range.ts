import type { DateRange } from '@/lib/analytics'

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

export const PRESETS: PresetKey[] = [
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

export type RangeSP = {
  preset?: string
  from?: string
  to?: string
  tz?: string
}

// Resolve o período a partir dos query params. Default = hoje (UTC); o cliente
// corrige para o fuso local via autoToday no OverviewFilter.
export function resolveRange(sp: RangeSP): {
  range: DateRange
  preset: PresetKey
  isDefault: boolean
} {
  if (sp.preset && sp.from && sp.to) {
    const preset = (PRESETS as string[]).includes(sp.preset)
      ? (sp.preset as PresetKey)
      : 'today'
    const tz = Number(sp.tz)
    return {
      range: { from: sp.from, to: sp.to, tz: Number.isFinite(tz) ? tz : 0 },
      preset,
      isDefault: false,
    }
  }
  const now = new Date()
  const from = new Date(now)
  from.setUTCHours(0, 0, 0, 0)
  return {
    range: { from: from.toISOString(), to: now.toISOString(), tz: 0 },
    preset: 'today',
    isDefault: true,
  }
}

export function fmtRangeLabel(range: DateRange): string {
  const opt: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }
  const a = new Date(range.from).toLocaleDateString('pt-BR', opt)
  const b = new Date(range.to).toLocaleDateString('pt-BR', opt)
  return a === b ? a : `${a} – ${b}`
}
