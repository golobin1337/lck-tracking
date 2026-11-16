// ============================================================
// GA4 — Measurement Protocol
// Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4
// Endpoints numa constante única.
// ============================================================
export const GA4_MP_ENDPOINT =
  'https://www.google-analytics.com/mp/collect'
export const GA4_MP_DEBUG_ENDPOINT =
  'https://www.google-analytics.com/debug/mp/collect'

export type GA4EventParams = Record<string, unknown> & {
  session_id?: string
  engagement_time_msec?: number
}

export type GA4Event = {
  name: string
  params?: GA4EventParams
}

export type GA4SendInput = {
  client_id: string
  user_id?: string
  events: GA4Event[]
  debug?: boolean
}

export type GA4SendResult = {
  ok: boolean
  status: number
  response: unknown
}

export function buildGA4Payload(input: GA4SendInput) {
  return {
    client_id: input.client_id,
    ...(input.user_id ? { user_id: input.user_id } : {}),
    events: input.events,
  }
}

export async function sendGA4Event(
  account: { measurement_id: string; api_secret: string },
  input: GA4SendInput
): Promise<GA4SendResult> {
  const base = input.debug ? GA4_MP_DEBUG_ENDPOINT : GA4_MP_ENDPOINT
  const url = `${base}?measurement_id=${encodeURIComponent(
    account.measurement_id
  )}&api_secret=${encodeURIComponent(account.api_secret)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildGA4Payload(input)),
    })
    // O endpoint normal retorna 204 sem corpo; o /debug retorna JSON.
    const text = await res.text()
    let response: unknown = null
    if (text) {
      try {
        response = JSON.parse(text)
      } catch {
        response = text
      }
    }
    return { ok: res.ok, status: res.status, response }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}
