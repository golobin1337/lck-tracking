import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Pixels Meta, propriedades GA4, contas de anúncio e webhook."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Em breve (Fase 7).
        </CardContent>
      </Card>
    </>
  )
}
