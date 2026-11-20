import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { getOfferIdBySlug, getDefaultOfferId } from '@/lib/offers'
import { getActivePixels } from '@/lib/destinations'
import { hashText } from '@/lib/hash'
import { getClientIp, getUserAgent } from '@/lib/request'
import { rateLimit } from '@/lib/rate-limit'
import { corsJson, corsPreflight } from '@/lib/cors'
import { sendMetaEvent, buildMetaPayload, type MetaUserData } from '@/lib/meta'
import type { Visitor, Geo } from '@/types/database'

export const runtime = 'nodejs'

export function OPTIONS() {
  return corsPreflight()
}

type EventBody = {
  offer?: string
  trck_user_id?: string
  event_name?: string
  event_id?: string
  event_source_url?: string
  value?: number
  currency?: string
  content_ids?: string[]
  content_name?: string
  content_type?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

function geoCity(geo: Geo) {
  return geo?.city ?? null
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const limited = rateLimit(`event:${ip ?? 'unknown'}`, 120, 60_000)
  if (!limited.allowed) {
    return corsJson({ error: 'rate_limited' }, 429)
  }

  let body: EventBody
  try {
    body = (await request.json()) as EventBody
  } catch {
    return corsJson({ error: 'invalid_json' }, 400)
  }

  if (!body.event_name) {
    return corsJson({ error: 'event_name_required' }, 400)
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return corsJson({ error: 'owner_not_found' }, 500)
  }

  const admin = createAdminClient()
  const eventId = body.event_id?.trim() || randomUUID()

  // Dedup: se já registramos esse event_id, não reenviar.
  const { data: existing } = await admin
    .from('events_log')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (existing) {
    return corsJson({ event_id: eventId, deduped: true })
  }

  // Enriquecer com o visitante.
  let visitor: Visitor | null = null
  if (body.trck_user_id) {
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('trck_user_id', body.trck_user_id)
      .maybeSingle()
    visitor = (data as Visitor) ?? null
  }

  const clientIp = visitor?.ip ?? ip ?? undefined
  const clientUa = visitor?.user_agent ?? getUserAgent(request.headers) ?? undefined
  const geo: Geo = visitor?.geo ?? null

  const userData: MetaUserData = {
    em: visitor?.email_hash ?? undefined,
    ph: visitor?.phone_hash ?? undefined,
    ct: hashText(geoCity(geo)),
    st: hashText(geo?.state ?? null),
    country: hashText(geo?.country ?? null),
    external_id: body.trck_user_id ? hashText(body.trck_user_id) : undefined,
    fbp: visitor?.fbp ?? undefined,
    fbc: visitor?.fbc ?? undefined,
    client_ip_address: clientIp,
    client_user_agent: clientUa,
  }

  const customData =
    body.value !== undefined ||
    body.currency ||
    body.content_ids ||
    body.content_name ||
    body.content_type
      ? {
          ...(body.value !== undefined ? { value: body.value } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
          ...(body.content_ids ? { content_ids: body.content_ids } : {}),
          ...(body.content_name ? { content_name: body.content_name } : {}),
          ...(body.content_type ? { content_type: body.content_type } : {}),
        }
      : undefined

  // test_event_code das settings (modo debug da Meta).
  const { data: settings } = await admin
    .from('settings')
    .select('test_event_code')
    .eq('user_id', ownerId)
    .maybeSingle()
  const testEventCode = settings?.test_event_code ?? undefined

  const eventInput = {
    event_name: body.event_name,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: body.event_source_url,
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  }

  // Oferta: do visitante, senão do slug enviado, senão a padrão.
  const offerId =
    (visitor as { offer_id?: string | null } | null)?.offer_id ??
    (await getOfferIdBySlug(body.offer)) ??
    (await getDefaultOfferId())

  // Disparar para os pixels ativos DA OFERTA.
  const pixels = await getActivePixels(ownerId, offerId)
  const metaPayload = buildMetaPayload(eventInput, testEventCode)
  const metaResponses: unknown[] = []
  for (const pixel of pixels) {
    const result = await sendMetaEvent(
      { pixel_id: pixel.pixel_id, token: pixel.token },
      eventInput,
      testEventCode
    )
    metaResponses.push({
      pixel_id: pixel.pixel_id,
      label: pixel.label,
      status: result.status,
      ok: result.ok,
      response: result.response,
    })
  }

  // Registrar no events_log.
  const { error: insertError } = await admin.from('events_log').insert({
    user_id: ownerId,
    offer_id: offerId,
    trck_user_id: body.trck_user_id ?? null,
    event_name: body.event_name,
    event_id: eventId,
    utm_source: body.utm_source ?? visitor?.utm_source ?? null,
    utm_medium: body.utm_medium ?? visitor?.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? visitor?.utm_campaign ?? null,
    utm_term: body.utm_term ?? visitor?.utm_term ?? null,
    utm_content: body.utm_content ?? visitor?.utm_content ?? null,
    payload_meta: pixels.length ? metaPayload : null,
    response_meta: pixels.length ? metaResponses : null,
    payload_ga4: null, // GA4 web vai pela gtag; MP só na compra (webhook)
    response_ga4: null,
    ip: clientIp ?? null,
    geo: geo ?? null,
  })

  if (insertError) {
    return corsJson({ error: 'db_error', detail: insertError.message }, 500)
  }

  return corsJson({
    event_id: eventId,
    pixels_sent: pixels.length,
  })
}
