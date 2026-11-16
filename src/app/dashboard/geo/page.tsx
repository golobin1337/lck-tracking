import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function GeoPage() {
  return (
    <>
      <PageHeader
        title="Geo"
        description="Mapa por região a partir do geo do IP."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Em breve (Fase 6).
        </CardContent>
      </Card>
    </>
  )
}
