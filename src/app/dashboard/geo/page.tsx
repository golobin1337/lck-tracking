import { createClient } from '@/lib/supabase/server'
import { getGeoBreakdown, type GeoBucket } from '@/lib/analytics'
import { countryName, countryNumericId } from '@/lib/geo-data'
import { PageHeader } from '@/components/dashboard/page-header'
import { WorldMap } from '@/components/dashboard/world-map'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

function RankList({
  items,
  empty,
}: {
  items: GeoBucket[]
  empty: string
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
    )
  }
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="flex flex-col gap-2">
      {items.slice(0, 10).map((item) => (
        <div key={item.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="truncate">{item.label}</span>
            <span className="tabular font-medium text-muted-foreground">
              {formatNumber(item.count)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((item.count / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function GeoPage() {
  const supabase = await createClient()
  const geo = await getGeoBreakdown(supabase)

  // Contagens para o mapa (ISO numérico → total).
  const counts: Record<string, number> = {}
  let max = 0
  for (const c of geo.countries) {
    const id = countryNumericId(c.key)
    if (!id) continue
    counts[id] = (counts[id] ?? 0) + c.count
    if (counts[id] > max) max = counts[id]
  }

  const countriesNamed: GeoBucket[] = geo.countries.map((c) => ({
    ...c,
    label: countryName(c.key),
  }))

  return (
    <>
      <PageHeader
        title="Geo"
        description={`${formatNumber(geo.located)} de ${formatNumber(
          geo.total
        )} visitantes localizados pelo IP.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa por país</CardTitle>
          <CardDescription>
            Intensidade proporcional ao nº de visitantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorldMap counts={counts} max={max} />
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Países</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList items={countriesNamed} empty="Sem dados de país." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estados / regiões</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList items={geo.states} empty="Sem dados de estado." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cidades</CardTitle>
          </CardHeader>
          <CardContent>
            <RankList items={geo.cities} empty="Sem dados de cidade." />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
