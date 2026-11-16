import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'text-primary',
  hint,
}: {
  label: string
  value: string
  icon: LucideIcon
  accent?: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={cn('size-4', accent)} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
