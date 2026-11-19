import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'
import { corsHeaders, corsPreflight } from '@/lib/cors'

export const runtime = 'nodejs'

export function OPTIONS() {
  return corsPreflight()
}

// Config PÚBLICA para o snippet do navegador (public/t.js).
// Retorna SÓ IDs públicos (pixel_id, measurement_id) dos destinos ativos.
// NUNCA descriptografa segredos (não usa getActivePixels/getActiveGa4Accounts).
export async function GET() {
  const headers = {
    'content-type': 'application/json',
    // Cacheável na borda por 5min; o navegador revalida a cada 1min.
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    ...corsHeaders,
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return new Response(JSON.stringify({ pixels: [], ga4: [] }), { headers })
  }

  const admin = createAdminClient()
  const [pixelsRes, ga4Res] = await Promise.all([
    admin
      .from('meta_pixels')
      .select('pixel_id')
      .eq('user_id', ownerId)
      .eq('active', true),
    admin
      .from('ga4_accounts')
      .select('measurement_id')
      .eq('user_id', ownerId)
      .eq('active', true),
  ])

  const pixels = (pixelsRes.data ?? [])
    .map((p) => p.pixel_id)
    .filter((v): v is string => !!v)
  const ga4 = (ga4Res.data ?? [])
    .map((g) => g.measurement_id)
    .filter((v): v is string => !!v)

  return new Response(JSON.stringify({ pixels, ga4 }), { headers })
}
