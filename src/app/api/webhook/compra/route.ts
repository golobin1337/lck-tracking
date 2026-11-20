import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { getActivePixels, getActiveGa4Accounts } from '@/lib/destinations'
import { hashEmail, hashPhone, hashText, digitsOnly } from '@/lib/hash'
import { sendMetaEvent, type MetaUserData, type MetaCustomData } from '@/lib/meta'
import { sendGA4Event } from '@/lib/ga4'
import {
  type WiapyPayload,
  centsToAmount,
  isAbandonedCart,
  splitName,
} from '@/lib/wiapy'
import type { Visitor, Geo } from '@/types/database'

export const runtime = 'nodejs'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// fbc = "fb.1.<timestamp>.<fbclid>". O fbclid é constante do anúncio ao
// checkout (o timestamp muda entre domínios), então serve de ponte.
function extractFbclid(fbc?: string | null): string | null {
  if (!fbc) return null
  const parts = fbc.split('.')
  return parts.length >= 4 ? parts.slice(3).join('.') : null
}

export async function POST(request: Request) {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return json({ error: 'owner_not_found' }, 500)

  const admin = createAdminClient()

  // Config global (moeda, test_event_code).
  const { data: settings } = await admin
    .from('settings')
    .select('currency, test_event_code')
    .eq('user_id', ownerId)
    .maybeSingle()

  // ---- Autenticação: o token identifica a OFERTA (cada oferta tem o seu) ----
  const authHeader = request.headers.get('authorization') || ''
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!provided) return json({ error: 'unauthorized' }, 401)

  const { data: offersData } = await admin
    .from('offers')
    .select('id, webhook_token')
    .eq('user_id', ownerId)

  let offerId: string | null = null
  for (const o of offersData ?? []) {
    if (o.webhook_token && safeEqual(provided, o.webhook_token)) {
      offerId = o.id
      break
    }
  }
  if (!offerId) return json({ error: 'unauthorized' }, 401)

  // ---- Parse ----
  let payload: WiapyPayload
  try {
    payload = (await request.json()) as WiapyPayload
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // Carrinho abandonado: payment null → só confirma recebimento (lead futuro).
  if (isAbandonedCart(payload)) {
    return json({ ok: true, abandoned: true })
  }

  const payment = payload.payment!
  if (!payment.id) return json({ error: 'missing_transaction_id' }, 400)

  const transactionId = payment.id
  const customer = payload.customer ?? {}
  const checkout = payload.checkout ?? {}
  const tracking = payload.tracking ?? null
  const currency = settings?.currency || 'BRL'

  const emailHash = hashEmail(customer.email)
  const phoneHash = hashPhone(customer.mobile_phone)

  // ---- Vincular visitante / trck_user_id ----
  // Prioridade:
  // 1) utm_content = lck.id (quando a URL do checkout carrega o trck)
  // 2) fbclid dentro do fbc — PONTE PRINCIPAL: o fbclid é o mesmo do anúncio
  //    ao checkout; não depende de utm_content (que é do anúncio/UTMify).
  // 3) fbp (raro; cookie muda entre domínios)
  // 4) email_hash  5) phone_hash
  const utmTrck = tracking?.utm_content?.trim() || null
  const trackFbp = tracking?.fbp?.trim() || null
  const trackFbclid = extractFbclid(tracking?.fbc)
  let visitor: Visitor | null = null
  let matchType:
    | 'trck_user_id'
    | 'fbclid'
    | 'fbp'
    | 'email'
    | 'phone'
    | 'utm_content'
    | 'none' = 'none'

  if (utmTrck) {
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('trck_user_id', utmTrck)
      .eq('offer_id', offerId)
      .maybeSingle()
    if (data) {
      visitor = data as Visitor
      matchType = 'trck_user_id'
    }
  }
  if (!visitor && trackFbclid) {
    // Busca ampla por sufixo e confirma o fbclid exato em memória.
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('offer_id', offerId)
      .like('fbc', `%${trackFbclid}`)
      .order('created_at', { ascending: false })
      .limit(20)
    const match = (data as Visitor[] | null)?.find(
      (v) => extractFbclid(v.fbc) === trackFbclid
    )
    if (match) {
      visitor = match
      matchType = 'fbclid'
    }
  }
  if (!visitor && trackFbp) {
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('fbp', trackFbp)
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      visitor = data as Visitor
      matchType = 'fbp'
    }
  }
  if (!visitor && emailHash) {
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('email_hash', emailHash)
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      visitor = data as Visitor
      matchType = 'email'
    }
  }
  if (!visitor && phoneHash) {
    const { data } = await admin
      .from('visitors')
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      visitor = data as Visitor
      matchType = 'phone'
    }
  }

  // trck final: visitante casado, senão o utm_content cru
  const trckUserId = visitor?.trck_user_id ?? utmTrck
  if (!visitor && utmTrck) matchType = 'utm_content'

  // ---- Idempotência ----
  const { data: existing } = await admin
    .from('purchases')
    .select('id, conversion_sent')
    .eq('transaction_id', transactionId)
    .maybeSingle()

  const shouldDispatch =
    payment.status === 'paid' && existing?.conversion_sent !== true

  const valor = centsToAmount(payment.amount)
  const geo: Geo = visitor?.geo ?? null

  // Linha base da compra (sempre atualiza status/dados).
  const purchaseRow: Record<string, unknown> = {
    user_id: ownerId,
    offer_id: offerId,
    transaction_id: transactionId,
    trck_user_id: trckUserId,
    email: customer.email ?? null,
    email_hash: emailHash ?? null,
    phone: digitsOnly(customer.mobile_phone),
    phone_hash: phoneHash ?? null,
    produto: checkout.title ?? null,
    valor,
    moeda: currency,
    status: payment.status,
    payment_method: payment.payment_method ?? null,
    installments: payment.installments ?? null,
    utm_source: tracking?.utm_source ?? visitor?.utm_source ?? null,
    utm_medium: tracking?.utm_medium ?? visitor?.utm_medium ?? null,
    utm_campaign: tracking?.utm_campaign ?? visitor?.utm_campaign ?? null,
    utm_term: tracking?.utm_term ?? visitor?.utm_term ?? null,
    utm_content: tracking?.utm_content ?? visitor?.utm_content ?? null,
    fbp: tracking?.fbp ?? visitor?.fbp ?? null,
    fbc: tracking?.fbc ?? visitor?.fbc ?? null,
    geo,
    match_type: matchType,
    ga_client_id: visitor?.ga_client_id ?? null,
    webhook_raw: payload as unknown as Record<string, unknown>,
  }

  // ---- Disparo da conversão (só em 'paid' e ainda não enviada) ----
  if (shouldDispatch) {
    const { first, last } = splitName(customer.name)
    const contentIds =
      payload.products?.map((p) => p.id) ??
      (checkout.id ? [checkout.id] : undefined)

    const userData: MetaUserData = {
      em: emailHash ?? undefined,
      ph: phoneHash ?? undefined,
      fn: hashText(first),
      ln: hashText(last),
      ct: hashText(geo?.city ?? null),
      st: hashText(geo?.state ?? null),
      country: hashText(geo?.country ?? null),
      external_id: trckUserId ? hashText(trckUserId) : undefined,
      fbp: tracking?.fbp ?? visitor?.fbp ?? undefined,
      fbc: tracking?.fbc ?? visitor?.fbc ?? undefined,
      client_ip_address: tracking?.ip ?? visitor?.ip ?? undefined,
      client_user_agent: tracking?.useragent ?? visitor?.user_agent ?? undefined,
    }

    const customData: MetaCustomData = {
      value: valor ?? undefined,
      currency,
      ...(contentIds ? { content_ids: contentIds } : {}),
      ...(checkout.title ? { content_name: checkout.title } : {}),
      content_type: 'product',
    }

    // Meta CAPI → todos os pixels ativos
    const pixels = await getActivePixels(ownerId, offerId)
    const metaResponses: unknown[] = []
    for (const pixel of pixels) {
      const r = await sendMetaEvent(
        { pixel_id: pixel.pixel_id, token: pixel.token },
        {
          event_name: 'Purchase',
          event_id: transactionId,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: userData,
          custom_data: customData,
        },
        settings?.test_event_code ?? undefined
      )
      metaResponses.push({
        pixel_id: pixel.pixel_id,
        label: pixel.label,
        status: r.status,
        ok: r.ok,
        response: r.response,
      })
    }

    // GA4 MP → todos os GA4 ativos (só se houver client_id do visitante)
    const ga4Responses: unknown[] = []
    const clientId = visitor?.ga_client_id
    if (clientId) {
      const accounts = await getActiveGa4Accounts(ownerId, offerId)
      for (const acc of accounts) {
        const r = await sendGA4Event(
          { measurement_id: acc.measurement_id, api_secret: acc.api_secret },
          {
            client_id: clientId,
            events: [
              {
                name: 'purchase',
                params: {
                  transaction_id: transactionId,
                  value: valor ?? 0,
                  currency,
                  items: [
                    {
                      item_name: checkout.title ?? 'produto',
                      price: valor ?? 0,
                      quantity: 1,
                    },
                  ],
                  ...(visitor?.ga_session_id
                    ? { session_id: visitor.ga_session_id }
                    : {}),
                  engagement_time_msec: 1,
                },
              },
            ],
          }
        )
        ga4Responses.push({
          measurement_id: acc.measurement_id,
          label: acc.label,
          status: r.status,
          ok: r.ok,
          response: r.response,
        })
      }
    }

    purchaseRow.conversion_sent = true
    purchaseRow.meta_event_id = transactionId
    purchaseRow.response_meta = pixels.length ? metaResponses : null
    purchaseRow.response_ga4 = clientId && ga4Responses.length ? ga4Responses : null
  }

  // ---- UPSERT idempotente ----
  const { error: upsertError } = await admin
    .from('purchases')
    .upsert(purchaseRow, { onConflict: 'transaction_id' })

  if (upsertError) {
    // 500 permite que a Wiapy reenvie (não perdemos a compra).
    return json({ error: 'db_error', detail: upsertError.message }, 500)
  }

  // Registra o Purchase na timeline de Eventos (só quando pago).
  // event_id único por transação → idempotente (reenvios não duplicam).
  if (payment.status === 'paid') {
    await admin.from('events_log').upsert(
      {
        user_id: ownerId,
        offer_id: offerId,
        trck_user_id: trckUserId,
        event_name: 'Purchase',
        event_id: `wh-${transactionId}`,
        // Preferir os UTMs reais do anúncio (do visitante) para exibição;
        // o utm_content do checkout costuma ser o lck.id (não o anúncio).
        utm_source: visitor?.utm_source ?? tracking?.utm_source ?? null,
        utm_medium: visitor?.utm_medium ?? tracking?.utm_medium ?? null,
        utm_campaign: visitor?.utm_campaign ?? tracking?.utm_campaign ?? null,
        utm_term: visitor?.utm_term ?? tracking?.utm_term ?? null,
        utm_content: visitor?.utm_content ?? tracking?.utm_content ?? null,
        ip: visitor?.ip ?? tracking?.ip ?? null,
        geo,
        payload_meta: {
          source: 'webhook',
          transaction_id: transactionId,
          value: valor,
          currency,
          produto: checkout.title ?? null,
          payment_method: payment.payment_method ?? null,
        },
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )
  }

  return json({
    ok: true,
    transaction_id: transactionId,
    status: payment.status,
    match_type: matchType,
    conversion_dispatched: shouldDispatch,
  })
}
