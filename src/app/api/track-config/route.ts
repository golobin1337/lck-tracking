import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { getOfferIdBySlug, getDefaultOfferId } from '@/lib/offers'
import { getClientIp } from '@/lib/request'
import { rateLimit } from '@/lib/rate-limit'
import { corsHeaders, corsPreflight } from '@/lib/cors'

export const runtime = 'nodejs'

export function OPTIONS() {
  return corsPreflight()
}

// Config PÚBLICA para o snippet do navegador (public/t.js).
// Retorna SÓ IDs públicos (pixel_id, measurement_id) dos destinos ativos.
// NUNCA descriptografa segredos (não usa getActivePixels/getActiveGa4Accounts).
export async function GET(request: Request) {
  const headers = {
    'content-type': 'application/json',
    // Cacheável na borda por 5min; o navegador revalida a cada 1min.
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    ...corsHeaders,
  }

  const ip = getClientIp(request.headers)
  const limited = rateLimit(`track-config:${ip ?? 'unknown'}`, 60, 60_000)
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers,
    })
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return new Response(JSON.stringify({ pixels: [], ga4: [] }), { headers })
  }

  // Oferta (pela query ?offer=slug) → senão a oferta padrão.
  const slug = new URL(request.url).searchParams.get('offer')
  const offerId =
    (await getOfferIdBySlug(slug)) ?? (await getDefaultOfferId())

  const admin = createAdminClient()
  const pixelQ = admin
    .from('meta_pixels')
    .select('pixel_id')
    .eq('user_id', ownerId)
    .eq('active', true)
  const ga4Q = admin
    .from('ga4_accounts')
    .select('measurement_id')
    .eq('user_id', ownerId)
    .eq('active', true)
  if (offerId) {
    pixelQ.eq('offer_id', offerId)
    ga4Q.eq('offer_id', offerId)
  }
  const [pixelsRes, ga4Res] = await Promise.all([pixelQ, ga4Q])

  const pixels = (pixelsRes.data ?? [])
    .map((p) => p.pixel_id)
    .filter((v): v is string => !!v)
  const ga4 = (ga4Res.data ?? [])
    .map((g) => g.measurement_id)
    .filter((v): v is string => !!v)

  return new Response(JSON.stringify({ pixels, ga4 }), { headers })
}
