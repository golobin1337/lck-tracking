import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function FaturamentoPage() {
  return (
    <>
      <PageHeader
        title="Faturamento"
        description="Receita, ticket médio, reembolsos e tabela de compras."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Em breve (Fase 5).
        </CardContent>
      </Card>
    </>
  )
}
