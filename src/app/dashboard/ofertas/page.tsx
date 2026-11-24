import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveAdAccounts } from '@/lib/destinations'
import { getAdSpendTotal } from '@/lib/meta-ads'
import { getOwnerUserId } from '@/lib/owner'
import { PageHeader } from '@/components/dashboard/page-header'
import { formatCurrency } from '@/lib/utils'
import { resolveRange } from '@/lib/date-range'
import { OverviewFilter } from '@/components/dashboard/overview-filter'
import { OfferCards, type OfferCardData } from './offer-cards'

type SP = { preset?: string; from?: string; to?: string; tz?: string }

export default async function OfertasPage(props: {
  searchParams: Promise<SP>
}) {
  const sp = await props.searchParams
  const { range, preset, isDefault } = resolveRange(sp)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const ownerId = await getOwnerUserId()
  const { data: offers } = await admin
    .from('offers')
    .select('id, name, slug')
    .eq('user_id', ownerId!)
    .order('created_at', { ascending: true })

  if (!offers || offers.length === 0) {
    return (
      <>
        <PageHeader
          title="Ofertas"
          description="Visão geral de todas as suas ofertas."
        />
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma oferta cadastrada. Crie uma em Configurações.
        </p>
      </>
    )
  }

  const since = range.from.slice(0, 10)
  const until = range.to.slice(0, 10)

  const cards: OfferCardData[] = await Promise.all(
    offers.map(async (offer) => {
      const [revenueRes, accounts, sparkData] = await Promise.all([
        (async () => {
          const { data } = await supabase
            .from('purchases')
            .select('valor')
            .eq('status', 'paid')
            .eq('offer_id', offer.id)
            .gte('created_at', range.from)
            .lte('created_at', range.to)
          return (data ?? []).reduce(
            (s, r) => s + Number(r.valor ?? 0),
            0
          )
        })(),
        getActiveAdAccounts(user.id, offer.id),
        (async () => {
          const { data } = await supabase
            .from('purchases')
            .select('valor, created_at')
            .eq('status', 'paid')
            .eq('offer_id', offer.id)
            .gte('created_at', range.from)
            .lte('created_at', range.to)
            .order('created_at', { ascending: true })
          if (!data || data.length === 0) return []
          const buckets = new Map<string, number>()
          for (const r of data) {
            const day = r.created_at.slice(0, 10)
            buckets.set(day, (buckets.get(day) ?? 0) + Number(r.valor ?? 0))
          }
          return [...buckets.entries()].map(([d, v]) => ({ day: d, value: v }))
        })(),
      ])

      const spend = accounts.length > 0
        ? await getAdSpendTotal(
            accounts.map((a) => ({
              id: a.id,
              ad_account_id: a.ad_account_id,
              token: a.token,
            })),
            since,
            until
          )
        : 0

      const lucro = revenueRes - spend
      const roi = spend > 0 ? revenueRes / spend : null

      return {
        id: offer.id,
        name: offer.name,
        slug: offer.slug,
        revenue: revenueRes,
        spend,
        lucro,
        roi,
        spark: sparkData,
      }
    })
  )

  return (
    <>
      <PageHeader
        title="Ofertas"
        description="Visão geral de todas as suas ofertas."
      >
        <OverviewFilter basePath="/dashboard/ofertas" autoToday preset={preset} />
      </PageHeader>

      <OfferCards cards={cards} />
    </>
  )
}
