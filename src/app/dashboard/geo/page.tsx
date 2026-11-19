import { createClient } from '@/lib/supabase/server'
import { getGeoBreakdown } from '@/lib/analytics'
import { PageHeader } from '@/components/dashboard/page-header'
import { GeoSection } from '@/components/dashboard/geo-section'
import { formatNumber } from '@/lib/utils'

export default async function GeoPage() {
  const supabase = await createClient()
  const geo = await getGeoBreakdown(supabase)

  return (
    <>
      <PageHeader
        title="Geo"
        description={`${formatNumber(geo.located)} de ${formatNumber(
          geo.total
        )} visitantes localizados pelo IP.`}
      />
      <GeoSection geo={geo} />
    </>
  )
}
