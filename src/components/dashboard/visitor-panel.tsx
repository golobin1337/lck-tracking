'use client'

import * as React from 'react'
import { X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Visitor = {
  trck_user_id: string
  email: string | null
  phone: string | null
  geo: { country?: string | null; state?: string | null; city?: string | null } | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  fbp: string | null
  fbc: string | null
  ga_client_id: string | null
  ga_session_id: string | null
  ip: string | null
}

// Encurta o referrer para o domínio (ex.: "instagram.com").
function refLabel(ref?: string | null): string | null {
  if (!ref) return null
  try {
    return new URL(ref).hostname.replace(/^www\./, '')
  } catch {
    return ref
  }
}

type EventItem = {
  id: string
  event_name: string
  created_at: string
  utm_source: string | null
  utm_campaign: string | null
  payload_meta: unknown
  response_meta: unknown
  payload_ga4: unknown
  response_ga4: unknown
}

function hasPayload(e: EventItem): boolean {
  return !!(
    e.payload_meta ||
    e.response_meta ||
    e.payload_ga4 ||
    e.response_ga4
  )
}

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

function fmtLocal(geo: Visitor['geo']): string | null {
  if (!geo) return null
  const parts = [geo.city, geo.state, geo.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('break-all text-right', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  )
}

export function VisitorPanel({
  trckUserId,
  onClose,
}: {
  trckUserId: string
  onClose: () => void
}) {
  const [shown, setShown] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [visitor, setVisitor] = React.useState<Visitor | null>(null)
  const [events, setEvents] = React.useState<EventItem[]>([])
  const [openJson, setOpenJson] = React.useState<string | null>(null)

  React.useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [])

  // Fecha no ESC.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    const supabase = createClient()
    ;(async () => {
      const [v, e] = await Promise.all([
        supabase
          .from('visitors')
          .select(
            'trck_user_id, email, phone, geo, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, fbp, fbc, ga_client_id, ga_session_id, ip'
          )
          .eq('trck_user_id', trckUserId)
          .maybeSingle(),
        supabase
          .from('events_log')
          .select(
            'id, event_name, created_at, utm_source, utm_campaign, payload_meta, response_meta, payload_ga4, response_ga4'
          )
          .eq('trck_user_id', trckUserId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      if (!active) return
      setVisitor((v.data as Visitor) ?? null)
      setEvents((e.data as EventItem[]) ?? [])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [trckUserId])

  const origem =
    visitor && (visitor.utm_source || visitor.utm_medium)
      ? [visitor.utm_source, visitor.utm_medium].filter(Boolean).join(' / ')
      : null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          shown ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-2xl transition-transform duration-300',
          shown ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="font-semibold">Perfil do usuário</h2>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {trckUserId}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : (
            <>
              {/* Dados do visitante */}
              {visitor ? (
                <div>
                  <Field label="E-mail" value={visitor.email} />
                  <Field label="Telefone" value={visitor.phone} />
                  <Field label="Local" value={fmtLocal(visitor.geo)} />
                  <Field label="Origem" value={origem} />
                  <Field label="Campanha" value={visitor.utm_campaign} />
                  <Field label="Conteúdo" value={visitor.utm_content} />
                  <Field label="Referrer" value={visitor.referrer} />
                  <Field label="fbp" value={visitor.fbp} mono />
                  <Field label="fbc" value={visitor.fbc} mono />
                  <Field label="ga_client_id" value={visitor.ga_client_id} mono />
                  <Field label="ip" value={visitor.ip} mono />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Visitante não encontrado (evento sem identificação).
                </p>
              )}

              {/* Histórico de eventos */}
              <div>
                <h3 className="mb-2 font-semibold">
                  Histórico de eventos ({events.length})
                </h3>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem eventos.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {events.map((e) => {
                      const ref = refLabel(visitor?.referrer)
                      const utm =
                        e.utm_campaign || e.utm_source
                          ? [e.utm_source, e.utm_campaign]
                              .filter(Boolean)
                              .join(' · ')
                          : ref
                            ? `via ${ref}`
                            : 'direto / sem UTMs'
                      const isOpen = openJson === e.id
                      const clickable = hasPayload(e)
                      return (
                        <div
                          key={e.id}
                          className={cn(
                            'overflow-hidden rounded-lg border bg-card/40 transition-colors',
                            isOpen
                              ? 'border-primary/50'
                              : 'border-border',
                            clickable && !isOpen && 'hover:border-primary/40'
                          )}
                        >
                          <div
                            role={clickable ? 'button' : undefined}
                            onClick={() =>
                              clickable && setOpenJson(isOpen ? null : e.id)
                            }
                            className={cn(
                              'flex items-start justify-between gap-2 p-2.5',
                              clickable &&
                                'cursor-pointer hover:bg-secondary/40'
                            )}
                          >
                            <div className="min-w-0">
                              <Badge variant={eventVariant(e.event_name)}>
                                {e.event_name}
                              </Badge>
                              <p className="mt-1.5 truncate text-xs text-muted-foreground">
                                {utm}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="tabular text-xs text-muted-foreground">
                                {fmtDate(e.created_at)}
                              </span>
                              {clickable && (
                                <span className="flex items-center gap-0.5 text-[11px] text-primary">
                                  detalhes
                                  <ChevronDown
                                    className={cn(
                                      'size-3.5 transition-transform',
                                      isOpen && 'rotate-180'
                                    )}
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                          {isOpen && (
                            <pre
                              onClick={(ev) => ev.stopPropagation()}
                              className="max-h-72 overflow-auto border-t border-border bg-background/60 p-2.5 font-mono text-[11px] leading-relaxed"
                            >
                              {JSON.stringify(
                                {
                                  payload_meta: e.payload_meta,
                                  response_meta: e.response_meta,
                                  payload_ga4: e.payload_ga4,
                                  response_ga4: e.response_ga4,
                                },
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
