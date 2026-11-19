import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { GRAPH_API_VERSION } from '@/lib/meta'

export const runtime = 'nodejs'

const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`

function encKey(): string {
  const k = process.env.ENCRYPTION_KEY
  if (!k) throw new Error('ENCRYPTION_KEY ausente')
  return k
}

function baseUrl(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host')
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const base = baseUrl(request)
  const back = (q: string) =>
    NextResponse.redirect(`${base}/dashboard/configuracoes?meta=${q}`)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = request.headers
    .get('cookie')
    ?.match(/meta_oauth_state=([^;]+)/)?.[1]

  // Usuário cancelou no Facebook.
  if (url.searchParams.get('error')) return back('cancelled')
  if (!code || !state || !cookieState || state !== cookieState) {
    return back('bad_state')
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) return back('no_owner')

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('settings')
    .select('fb_app_id, fb_app_secret_enc')
    .eq('user_id', ownerId)
    .maybeSingle()

  const appId = settings?.fb_app_id
  if (!appId || !settings?.fb_app_secret_enc) return back('no_app')

  const { data: secret } = await admin.rpc('decrypt_secret', {
    ciphertext: settings.fb_app_secret_enc,
    enc_key: encKey(),
  })
  if (!secret) return back('no_secret')

  const redirectUri = `${base}/api/meta/callback`

  try {
    // 1) code -> token curto
    const r1 = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(
        code
      )}`
    )
    const b1 = await r1.json().catch(() => null)
    if (!r1.ok || !b1?.access_token) return back('token_error')

    // 2) token curto -> token de longa duração (~60 dias)
    const r2 = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(
        secret
      )}&fb_exchange_token=${encodeURIComponent(b1.access_token)}`
    )
    const b2 = await r2.json().catch(() => null)
    const longToken: string = b2?.access_token || b1.access_token

    // 3) listar contas de anúncio
    const r3 = await fetch(
      `${GRAPH}/me/adaccounts?fields=account_id,name&limit=200&access_token=${encodeURIComponent(
        longToken
      )}`
    )
    const b3 = await r3.json().catch(() => null)
    if (!r3.ok) return back('accounts_error')
    const accounts: Array<{ account_id?: string; name?: string }> =
      b3?.data ?? []
    if (!accounts.length) return back('no_accounts')

    // cifrar o token uma vez
    const { data: enc } = await admin.rpc('encrypt_secret', {
      plaintext: longToken,
      enc_key: encKey(),
    })

    // upsert de cada conta (sem duplicar)
    for (const a of accounts) {
      const adAccountId = a.account_id ? String(a.account_id) : ''
      if (!adAccountId) continue
      const { data: existing } = await admin
        .from('meta_ad_accounts')
        .select('id')
        .eq('user_id', ownerId)
        .eq('ad_account_id', adAccountId)
        .maybeSingle()
      if (existing) {
        await admin
          .from('meta_ad_accounts')
          .update({
            label: a.name || 'Conta',
            ads_token_enc: enc,
            active: true,
          })
          .eq('id', existing.id)
      } else {
        await admin.from('meta_ad_accounts').insert({
          user_id: ownerId,
          label: a.name || 'Conta',
          ad_account_id: adAccountId,
          ads_token_enc: enc,
          active: true,
        })
      }
    }

    const res = back('connected')
    res.cookies.set('meta_oauth_state', '', { path: '/', maxAge: 0 })
    return res
  } catch {
    return back('exception')
  }
}
