import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { hashEmail, hashPhone, hashText, digitsOnly } from '@/lib/hash'
import {
  getClientIp,
  getUserAgent,
  geoFromHeaders,
} from '@/lib/request'
import { rateLimit } from '@/lib/rate-limit'
import { corsJson, corsPreflight } from '@/lib/cors'

export const runtime = 'nodejs'

export function OPTIONS() {
  return corsPreflight()
}

type IdentifyBody = {
  trck_user_id?: string
  email?: string
  phone?: string
  name?: string
  fbp?: string
  fbc?: string
  ga_client_id?: string
  ga_session_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer?: string
  pixel_id?: string
}

// Remove chaves com valor undefined/null (para UPSERT com merge).
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out as Partial<T>
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const limited = rateLimit(`identify:${ip ?? 'unknown'}`, 120, 60_000)
  if (!limited.allowed) {
    return corsJson({ error: 'rate_limited' }, 429)
  }

  let body: IdentifyBody
  try {
    body = (await request.json()) as IdentifyBody
  } catch {
    return corsJson({ error: 'invalid_json' }, 400)
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return corsJson({ error: 'owner_not_found' }, 500)
  }

  const trckUserId = body.trck_user_id?.trim() || randomUUID()
  const userAgent = getUserAgent(request.headers)
  const geo = geoFromHeaders(request.headers)

  const row = compact({
    user_id: ownerId,
    trck_user_id: trckUserId,
    email: body.email ?? null,
    email_hash: hashEmail(body.email) ?? null,
    phone: digitsOnly(body.phone),
    phone_hash: hashPhone(body.phone) ?? null,
    name_hash: hashText(body.name) ?? null,
    fbp: body.fbp ?? null,
    fbc: body.fbc ?? null,
    ga_client_id: body.ga_client_id ?? null,
    ga_session_id: body.ga_session_id ?? null,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_term: body.utm_term ?? null,
    utm_content: body.utm_content ?? null,
    referrer: body.referrer ?? null,
    ip: ip ?? null,
    user_agent: userAgent,
    geo: geo ?? null,
    pixel_id: body.pixel_id ?? null,
  })

  const admin = createAdminClient()
  const { error } = await admin
    .from('visitors')
    .upsert(row, { onConflict: 'trck_user_id' })

  if (error) {
    return corsJson({ error: 'db_error', detail: error.message }, 500)
  }

  return corsJson({ trck_user_id: trckUserId })
}
