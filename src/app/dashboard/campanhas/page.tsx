import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function CampanhasPage() {
  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Insights do Meta Ads cruzados com receita (ROAS e CPA)."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Em breve (Fase 6).
        </CardContent>
      </Card>
    </>
  )
}
