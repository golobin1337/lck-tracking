import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function EventosPage() {
  return (
    <>
      <PageHeader
        title="Eventos"
        description="Tabela filtrável com payload e resposta de cada destino."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Em breve (Fase 5).
        </CardContent>
      </Card>
    </>
  )
}
