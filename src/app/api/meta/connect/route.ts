import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { metaConnectKey } from '@/lib/meta-connect-key'
import { GRAPH_API_VERSION } from '@/lib/meta'

export const runtime = 'nodejs'

function baseUrl(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host')
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const base = baseUrl(request)

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return NextResponse.redirect(`${base}/dashboard/configuracoes?meta=no_owner`)
  }

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('settings')
    .select('fb_app_id')
    .eq('user_id', ownerId)
    .maybeSingle()

  const appId = settings?.fb_app_id
  if (!appId) {
    return NextResponse.redirect(
      `${base}/dashboard/configuracoes?meta=no_app`
    )
  }

  // Autorização: chave compartilhável (link para terceiros) OU login no painel.
  const k = new URL(request.url).searchParams.get('k')
  const validKey = !!k && k === metaConnectKey(appId)
  if (!validKey) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${base}/login`)
  }

  const state = randomBytes(16).toString('hex')
  const redirectUri = `${base}/api/meta/callback`
  const dialog =
    `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&response_type=code&scope=ads_read`

  const res = NextResponse.redirect(dialog)
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
