'use client'

import * as React from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export type EventRow = {
  id: string
  created_at: string
  event_name: string
  trck_user_id: string | null
  utm_source: string | null
  utm_campaign: string | null
  ip: string | null
  payload_meta: unknown
  response_meta: unknown
  payload_ga4: unknown
  response_ga4: unknown
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TABS = [
  { key: 'payload_meta', label: 'Payload Meta' },
  { key: 'response_meta', label: 'Resposta Meta' },
  { key: 'payload_ga4', label: 'Payload GA4' },
  { key: 'response_ga4', label: 'Resposta GA4' },
] as const

function JsonView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem dados.
      </p>
    )
  }
  return (
    <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function EventsTable({ events }: { events: EventRow[] }) {
  const [selected, setSelected] = React.useState<EventRow | null>(null)
  const [tab, setTab] = React.useState<(typeof TABS)[number]['key']>(
    'payload_meta'
  )

  function open(ev: EventRow) {
    setSelected(ev)
    setTab('payload_meta')
  }

  if (events.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum evento encontrado.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Evento</th>
              <th className="px-3 py-2 font-medium">trck_user_id</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium text-right">Payload</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr
                key={ev.id}
                className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
              >
                <td className="whitespace-nowrap px-3 py-2 tabular text-muted-foreground">
                  {fmtDate(ev.created_at)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{ev.event_name}</Badge>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                  {ev.trck_user_id ?? '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {ev.utm_source ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => open(ev)}
                    aria-label="Ver payload"
                  >
                    <Eye />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.event_name}</DialogTitle>
            <DialogDescription>
              {selected && fmtDate(selected.created_at)} ·{' '}
              {selected?.trck_user_id ?? 'sem trck'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {selected && <JsonView value={selected[tab]} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
