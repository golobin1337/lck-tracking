import { createAdminClient } from '@/lib/supabase/admin'

// Sistema single-owner: um dono do painel (com múltiplas contas de
// integração). Os endpoints públicos atribuem os dados a esse dono.
// Resolvemos pelo usuário mais antigo em auth.users e cacheamos em memória.

let cachedOwnerId: string | null = null

export async function getOwnerUserId(): Promise<string | null> {
  if (cachedOwnerId) return cachedOwnerId

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  if (error || !data?.users?.length) return null

  const sorted = [...data.users].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  cachedOwnerId = sorted[0]?.id ?? null
  return cachedOwnerId
}
