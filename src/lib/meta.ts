// ============================================================
// Meta — Conversions API
// Doc: https://developers.facebook.com/docs/marketing-api/conversions-api
// A versão da Graph API fica NESTA constante única (fácil de atualizar).
// ============================================================
export const GRAPH_API_VERSION = 'v26.0'
const GRAPH_API_BASE = 'https://graph.facebook.com'

// Dados pessoais: em, ph, fn, ln, ct, st, zp, country, external_id são
// SHA-256 (já hasheados pelo chamador). fbp, fbc, client_ip_address,
// client_user_agent NÃO são hasheados.
export type MetaUserData = {
  em?: string
  ph?: string
  fn?: string
  ln?: string
  ct?: string
  st?: string
  country?: string
  external_id?: string
  fbp?: string
  fbc?: string
  client_ip_address?: string
  client_user_agent?: string
}

export type MetaCustomData = {
  value?: number
  currency?: string
  content_ids?: string[]
  content_name?: string
  content_type?: string
  [key: string]: unknown
}

export type MetaEventInput = {
  event_name: string
  event_id: string
  event_time?: number // unix seconds; default now
  event_source_url?: string
  action_source?: string // default 'website'
  user_data: MetaUserData
  custom_data?: MetaCustomData
}

export type MetaSendResult = {
  ok: boolean
  status: number
  response: unknown
}

// Remove campos vazios do user_data.
function cleanUserData(ud: MetaUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ud)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}

export function buildMetaPayload(input: MetaEventInput, testEventCode?: string) {
  const event = {
    event_name: input.event_name,
    event_time: input.event_time ?? Math.floor(Date.now() / 1000),
    event_id: input.event_id,
    action_source: input.action_source ?? 'website',
    ...(input.event_source_url
      ? { event_source_url: input.event_source_url }
      : {}),
    user_data: cleanUserData(input.user_data),
    ...(input.custom_data ? { custom_data: input.custom_data } : {}),
  }
  return {
    data: [event],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }
}

export async function sendMetaEvent(
  pixel: { pixel_id: string; token: string },
  input: MetaEventInput,
  testEventCode?: string
): Promise<MetaSendResult> {
  const url = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${pixel.pixel_id}/events`
  const payload = {
    ...buildMetaPayload(input, testEventCode),
    access_token: pixel.token,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const response = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, response }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}
