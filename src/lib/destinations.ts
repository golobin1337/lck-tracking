import { createAdminClient } from '@/lib/supabase/admin'

// Busca destinos ativos do dono e descriptografa os segredos NO SERVIDOR
// via RPC decrypt_secret (service_role), usando ENCRYPTION_KEY.

type ActivePixel = { id: string; label: string; pixel_id: string; token: string }
type ActiveGa4 = {
  id: string
  label: string
  measurement_id: string
  api_secret: string
}

function encKey(): string {
  const k = process.env.ENCRYPTION_KEY
  if (!k) throw new Error('ENCRYPTION_KEY ausente no ambiente')
  return k
}

async function decrypt(
  admin: ReturnType<typeof createAdminClient>,
  ciphertext: string | null
): Promise<string | null> {
  if (!ciphertext) return null
  const { data, error } = await admin.rpc('decrypt_secret', {
    ciphertext,
    enc_key: encKey(),
  })
  if (error) return null
  return (data as string) ?? null
}

export async function getActivePixels(userId: string): Promise<ActivePixel[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('meta_pixels')
    .select('id, label, pixel_id, capi_token_enc')
    .eq('user_id', userId)
    .eq('active', true)
  if (error || !data) return []

  const out: ActivePixel[] = []
  for (const row of data) {
    const token = await decrypt(admin, row.capi_token_enc)
    if (token) {
      out.push({
        id: row.id,
        label: row.label,
        pixel_id: row.pixel_id,
        token,
      })
    }
  }
  return out
}

export async function getActiveGa4Accounts(
  userId: string
): Promise<ActiveGa4[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ga4_accounts')
    .select('id, label, measurement_id, api_secret_enc')
    .eq('user_id', userId)
    .eq('active', true)
  if (error || !data) return []

  const out: ActiveGa4[] = []
  for (const row of data) {
    const api_secret = await decrypt(admin, row.api_secret_enc)
    if (api_secret) {
      out.push({
        id: row.id,
        label: row.label,
        measurement_id: row.measurement_id,
        api_secret,
      })
    }
  }
  return out
}
