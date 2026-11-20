import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOfferId } from '@/lib/offers'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  EventsTable,
  type EventRow,
} from '@/components/dashboard/events-table'

const PAGE_SIZE = 50

type SP = {
  event_name?: string
  trck?: string
  from?: string
  to?: string
  page?: string
}

export default async function EventosPage(props: {
  searchParams: Promise<SP>
}) {
  const sp = await props.searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const supabase = await createClient()
  const offerId = await getCurrentOfferId()

  let query = supabase
    .from('events_log')
    .select(
      'id, created_at, event_name, trck_user_id, utm_campaign, utm_term, utm_content, geo',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (offerId) query = query.eq('offer_id', offerId)
  if (sp.event_name) query = query.eq('event_name', sp.event_name)
  if (sp.trck) query = query.eq('trck_user_id', sp.trck)
  if (sp.from) query = query.gte('created_at', `${sp.from}T00:00:00`)
  if (sp.to) query = query.lte('created_at', `${sp.to}T23:59:59`)

  const fromIdx = (page - 1) * PAGE_SIZE
  query = query.range(fromIdx, fromIdx + PAGE_SIZE - 1)

  const { data, count } = await query
  const events = (data ?? []) as EventRow[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams()
    if (sp.event_name) params.set('event_name', sp.event_name)
    if (sp.trck) params.set('trck', sp.trck)
    if (sp.from) params.set('from', sp.from)
    if (sp.to) params.set('to', sp.to)
    params.set('page', String(p))
    return `/dashboard/eventos?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        title="Eventos"
        description={`${total} evento(s) registrado(s).`}
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event_name">Evento</Label>
              <select
                id="event_name"
                name="event_name"
                defaultValue={sp.event_name ?? ''}
                className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos os eventos</option>
                <option value="PageView">PageView</option>
                <option value="ViewContent">ViewContent</option>
                <option value="InitiateCheckout">InitiateCheckout</option>
                <option value="Lead">Lead</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trck">trck_user_id</Label>
              <Input
                id="trck"
                name="trck"
                placeholder="id exato"
                defaultValue={sp.trck}
                className="w-56"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">De</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={sp.from}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">Até</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={sp.to}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filtrar</Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/dashboard/eventos">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <EventsTable events={events} />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
            >
              <Link href={buildPageHref(Math.max(1, page - 1))}>Anterior</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link href={buildPageHref(Math.min(totalPages, page + 1))}>
                Próxima
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
