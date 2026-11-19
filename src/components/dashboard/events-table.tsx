'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { VisitorPanel } from '@/components/dashboard/visitor-panel'

export type EventGeo = {
  country?: string | null
  state?: string | null
  city?: string | null
} | null

export type EventRow = {
  id: string
  created_at: string
  event_name: string
  trck_user_id: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  geo: EventGeo
}

// Cor do badge por tipo de evento.
function eventVariant(name: string): 'secondary' | 'warning' | 'success' {
  if (name === 'Purchase') return 'success'
  if (name === 'InitiateCheckout') return 'warning'
  return 'secondary'
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

function fmtLocal(geo: EventGeo): string {
  if (!geo) return '—'
  const parts = [geo.city, geo.state, geo.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

export function EventsTable({ events }: { events: EventRow[] }) {
  const [panelTrck, setPanelTrck] = React.useState<string | null>(null)

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
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Quando</th>
              <th className="px-3 py-2.5 font-medium">Evento</th>
              <th className="px-3 py-2.5 font-medium">Campanha</th>
              <th className="px-3 py-2.5 font-medium">Conjunto</th>
              <th className="px-3 py-2.5 font-medium">Anúncio</th>
              <th className="px-3 py-2.5 font-medium">Local</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr
                key={ev.id}
                onClick={() =>
                  ev.trck_user_id && setPanelTrck(ev.trck_user_id)
                }
                className={`border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/40 ${
                  ev.trck_user_id ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-3 py-3 tabular text-muted-foreground">
                  {fmtDate(ev.created_at)}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={eventVariant(ev.event_name)}>
                    {ev.event_name}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {ev.utm_campaign || '—'}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {ev.utm_term || '—'}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {ev.utm_content || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                  {fmtLocal(ev.geo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panelTrck && (
        <VisitorPanel
          trckUserId={panelTrck}
          onClose={() => setPanelTrck(null)}
        />
      )}
    </>
  )
}
