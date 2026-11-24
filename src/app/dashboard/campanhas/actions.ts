'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toggleEntityStatus, clearCampMetaCache } from '@/lib/meta-ads'
import { revalidatePath } from 'next/cache'

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

export async function toggleAdStatus(
  entityId: string,
  accountId: string,
  newStatus: 'ACTIVE' | 'PAUSED'
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from('meta_ad_accounts')
    .select('ads_token_enc')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (!account) return { ok: false, error: 'Conta não encontrada' }

  const token = await decrypt(admin, account.ads_token_enc)
  if (!token) return { ok: false, error: 'Token não encontrado' }

  const result = await toggleEntityStatus(entityId, token, newStatus)

  if (result.ok) {
    clearCampMetaCache(accountId)
    revalidatePath('/dashboard/campanhas')
  }

  return result
}
