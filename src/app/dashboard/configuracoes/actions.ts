'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashText } from '@/lib/hash'
import { sendMetaEvent, GRAPH_API_VERSION } from '@/lib/meta'
import { sendGA4Event } from '@/lib/ga4'

type AdminClient = ReturnType<typeof createAdminClient>
export type TestResult = { ok: boolean; message: string }

async function requireUserId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  return user.id
}

function encKey(): string {
  const k = process.env.ENCRYPTION_KEY
  if (!k) throw new Error('ENCRYPTION_KEY ausente')
  return k
}

async function encrypt(admin: AdminClient, plaintext: string): Promise<string> {
  const { data } = await admin.rpc('encrypt_secret', {
    plaintext,
    enc_key: encKey(),
  })
  return data as string
}

async function decrypt(
  admin: AdminClient,
  ciphertext: string | null
): Promise<string | null> {
  if (!ciphertext) return null
  const { data } = await admin.rpc('decrypt_secret', {
    ciphertext,
    enc_key: encKey(),
  })
  return (data as string) ?? null
}

const PATH = '/dashboard/configuracoes'

// ============================================================
// Ofertas
// ============================================================
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'oferta'
  )
}

export async function createOffer(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const name = String(formData.get('name') || '').trim()
  if (!name) throw new Error('Nome é obrigatório')

  const base = slugify(name)
  const { data: existing } = await admin
    .from('offers')
    .select('slug')
    .eq('user_id', userId)
  const taken = new Set((existing ?? []).map((o) => o.slug))
  let slug = base
  let i = 2
  while (taken.has(slug)) slug = `${base}-${i++}`

  await admin.from('offers').insert({ user_id: userId, name, slug })
  revalidatePath(PATH)
}

export async function renameOffer(id: string, name: string): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const n = name.trim()
  if (!n) throw new Error('Nome é obrigatório')
  await admin.from('offers').update({ name: n }).eq('id', id).eq('user_id', userId)
  revalidatePath(PATH)
}

export async function deleteOffer(id: string): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  // Bloqueia se a oferta tiver dados ou integrações.
  const tables = [
    'visitors',
    'events_log',
    'purchases',
    'meta_pixels',
    'ga4_accounts',
    'meta_ad_accounts',
  ]
  for (const t of tables) {
    const { count } = await admin
      .from(t)
      .select('id', { count: 'exact', head: true })
      .eq('offer_id', id)
    if ((count ?? 0) > 0) {
      throw new Error(
        'Esta oferta tem dados/integrações. Reatribua antes de apagar.'
      )
    }
  }
  await admin.from('offers').delete().eq('id', id).eq('user_id', userId)
  revalidatePath(PATH)
}

export async function generateOfferWebhookToken(id: string): Promise<string> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const token = 'whk_' + randomBytes(24).toString('hex')
  await admin
    .from('offers')
    .update({ webhook_token: token })
    .eq('id', id)
    .eq('user_id', userId)
  revalidatePath(PATH)
  return token
}

export async function assignIntegrationOffer(
  kind: 'pixel' | 'ga4' | 'ad',
  id: string,
  offerId: string
): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const table =
    kind === 'pixel'
      ? 'meta_pixels'
      : kind === 'ga4'
        ? 'ga4_accounts'
        : 'meta_ad_accounts'
  await admin
    .from(table)
    .update({ offer_id: offerId })
    .eq('id', id)
    .eq('user_id', userId)
  revalidatePath(PATH)
}

// ============================================================
// Settings
// ============================================================
export async function saveSettings(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const currency = String(formData.get('currency') || 'BRL').trim() || 'BRL'
  const testCode = String(formData.get('test_event_code') || '').trim() || null
  await admin
    .from('settings')
    .upsert(
      { user_id: userId, currency, test_event_code: testCode },
      { onConflict: 'user_id' }
    )
  revalidatePath(PATH)
}

// Credenciais do App do Facebook (para o OAuth "Conectar com Facebook").
export async function saveMetaApp(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const appId = String(formData.get('fb_app_id') || '').trim()
  const secret = String(formData.get('fb_app_secret') || '').trim()
  const row: Record<string, unknown> = { user_id: userId }
  if (appId) row.fb_app_id = appId
  if (secret) row.fb_app_secret_enc = await encrypt(admin, secret)
  await admin.from('settings').upsert(row, { onConflict: 'user_id' })
  revalidatePath(PATH)
}

export async function generateWebhookToken(): Promise<string> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const token = 'whk_' + randomBytes(24).toString('hex')
  await admin
    .from('settings')
    .upsert({ user_id: userId, webhook_token: token }, { onConflict: 'user_id' })
  revalidatePath(PATH)
  return token
}

// ============================================================
// Meta Pixels
// ============================================================
export async function savePixel(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const id = String(formData.get('id') || '').trim() || null
  const label = String(formData.get('label') || '').trim()
  const pixelId = String(formData.get('id_value') || '').trim()
  const secret = String(formData.get('secret') || '').trim()
  if (!label || !pixelId) throw new Error('Label e Pixel ID são obrigatórios')

  const row: Record<string, unknown> = {
    user_id: userId,
    label,
    pixel_id: pixelId,
  }
  if (secret) row.capi_token_enc = await encrypt(admin, secret)

  if (id) {
    await admin.from('meta_pixels').update(row).eq('id', id).eq('user_id', userId)
  } else {
    if (!secret) throw new Error('O token CAPI é obrigatório ao criar')
    await admin.from('meta_pixels').insert(row)
  }
  revalidatePath(PATH)
}

export async function deletePixel(id: string): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  await admin.from('meta_pixels').delete().eq('id', id).eq('user_id', userId)
  revalidatePath(PATH)
}

export async function testPixel(id: string): Promise<TestResult> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const { data } = await admin
    .from('meta_pixels')
    .select('pixel_id, capi_token_enc')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { ok: false, message: 'Pixel não encontrado' }
  const token = await decrypt(admin, data.capi_token_enc)
  if (!token) return { ok: false, message: 'Sem token configurado' }

  const { data: settings } = await admin
    .from('settings')
    .select('test_event_code')
    .eq('user_id', userId)
    .maybeSingle()

  const r = await sendMetaEvent(
    { pixel_id: data.pixel_id, token },
    {
      event_name: 'PageView',
      event_id: 'test-' + Date.now(),
      user_data: { external_id: hashText('test-connection') },
    },
    settings?.test_event_code ?? undefined
  )
  if (r.ok) return { ok: true, message: 'Conexão OK (evento de teste aceito)' }
  const msg =
    (r.response as { error?: { message?: string } })?.error?.message ||
    `HTTP ${r.status}`
  return { ok: false, message: msg }
}

// ============================================================
// GA4
// ============================================================
export async function saveGa4(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const id = String(formData.get('id') || '').trim() || null
  const label = String(formData.get('label') || '').trim()
  const measurementId = String(formData.get('id_value') || '').trim()
  const secret = String(formData.get('secret') || '').trim()
  if (!label || !measurementId)
    throw new Error('Label e Measurement ID são obrigatórios')

  const row: Record<string, unknown> = {
    user_id: userId,
    label,
    measurement_id: measurementId,
  }
  if (secret) row.api_secret_enc = await encrypt(admin, secret)

  if (id) {
    await admin.from('ga4_accounts').update(row).eq('id', id).eq('user_id', userId)
  } else {
    if (!secret) throw new Error('O API Secret é obrigatório ao criar')
    await admin.from('ga4_accounts').insert(row)
  }
  revalidatePath(PATH)
}

export async function deleteGa4(id: string): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  await admin.from('ga4_accounts').delete().eq('id', id).eq('user_id', userId)
  revalidatePath(PATH)
}

export async function testGa4(id: string): Promise<TestResult> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const { data } = await admin
    .from('ga4_accounts')
    .select('measurement_id, api_secret_enc')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { ok: false, message: 'Conta não encontrada' }
  const apiSecret = await decrypt(admin, data.api_secret_enc)
  if (!apiSecret) return { ok: false, message: 'Sem API Secret configurado' }

  const r = await sendGA4Event(
    { measurement_id: data.measurement_id, api_secret: apiSecret },
    {
      client_id: 'test.' + Date.now(),
      events: [{ name: 'page_view', params: {} }],
      debug: true,
    }
  )
  const msgs = (r.response as { validationMessages?: { description?: string }[] })
    ?.validationMessages
  if (r.ok && (!msgs || msgs.length === 0))
    return { ok: true, message: 'Conexão OK (payload validado)' }
  return {
    ok: false,
    message: msgs?.[0]?.description || `HTTP ${r.status}`,
  }
}

// ============================================================
// Meta Ad Accounts
// ============================================================
export async function saveAdAccount(formData: FormData): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const id = String(formData.get('id') || '').trim() || null
  const label = String(formData.get('label') || '').trim()
  const adAccountId = String(formData.get('id_value') || '').trim()
  const secret = String(formData.get('secret') || '').trim()
  if (!label || !adAccountId)
    throw new Error('Label e Ad Account ID são obrigatórios')

  const row: Record<string, unknown> = {
    user_id: userId,
    label,
    ad_account_id: adAccountId,
  }
  if (secret) row.ads_token_enc = await encrypt(admin, secret)

  if (id) {
    await admin
      .from('meta_ad_accounts')
      .update(row)
      .eq('id', id)
      .eq('user_id', userId)
  } else {
    if (!secret) throw new Error('O token de Ads é obrigatório ao criar')
    await admin.from('meta_ad_accounts').insert(row)
  }
  revalidatePath(PATH)
}

export async function deleteAdAccount(id: string): Promise<void> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  await admin.from('meta_ad_accounts').delete().eq('id', id).eq('user_id', userId)
  revalidatePath(PATH)
}

export async function testAdAccount(id: string): Promise<TestResult> {
  const userId = await requireUserId()
  const admin = createAdminClient()
  const { data } = await admin
    .from('meta_ad_accounts')
    .select('ad_account_id, ads_token_enc')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { ok: false, message: 'Conta não encontrada' }
  const token = await decrypt(admin, data.ads_token_enc)
  if (!token) return { ok: false, message: 'Sem token configurado' }

  const acct = data.ad_account_id.startsWith('act_')
    ? data.ad_account_id
    : `act_${data.ad_account_id}`
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${acct}?fields=name,account_status&access_token=${encodeURIComponent(
        token
      )}`
    )
    const body = await res.json().catch(() => null)
    if (res.ok)
      return { ok: true, message: `Conexão OK${body?.name ? `: ${body.name}` : ''}` }
    return { ok: false, message: body?.error?.message || `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'falha' }
  }
}
