import 'server-only'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerUserId } from '@/lib/owner'

export type Offer = {
  id: string
  name: string
  slug: string
}

export const OFFER_COOKIE = 'lck_offer'

// Lista as ofertas do dono (ordem de criação).
export async function listOffers(): Promise<Offer[]> {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('offers')
    .select('id, name, slug')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true })
  return (data as Offer[]) ?? []
}

// Oferta selecionada (cookie) ou a primeira. null se não há ofertas.
export async function getCurrentOffer(): Promise<Offer | null> {
  const offers = await listOffers()
  if (!offers.length) return null
  const cookieVal = (await cookies()).get(OFFER_COOKIE)?.value
  const found = cookieVal && offers.find((o) => o.id === cookieVal)
  return found || offers[0]
}

export async function getCurrentOfferId(): Promise<string | null> {
  return (await getCurrentOffer())?.id ?? null
}

// Oferta padrão (primeira) — usada para carimbar dados novos enquanto só há 1.
export async function getDefaultOfferId(): Promise<string | null> {
  const offers = await listOffers()
  return offers[0]?.id ?? null
}

// Resolve o offer_id a partir de um slug (para o snippet data-offer).
export async function getOfferIdBySlug(
  slug: string | null | undefined
): Promise<string | null> {
  if (!slug) return null
  const offers = await listOffers()
  return offers.find((o) => o.slug === slug)?.id ?? null
}
