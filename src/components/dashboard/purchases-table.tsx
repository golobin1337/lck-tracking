'use client'

import * as React from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

export type PurchaseRow = {
  id: string
  created_at: string
  transaction_id: string
  produto: string | null
  valor: number | null
  moeda: string
  status: string | null
  payment_method: string | null
  trck_user_id: string | null
  match_type: string | null
  utm_source: string | null
  conversion_sent: boolean
  webhook_raw: unknown
  response_meta: unknown
  response_ga4: unknown
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: string | null) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">pago</Badge>
    case 'unpaid':
      return <Badge variant="warning">aguardando</Badge>
    case 'refunded':
      return <Badge variant="destructive">reembolso</Badge>
    case 'chargedback':
      return <Badge variant="destructive">chargeback</Badge>
    case 'credit_card_declined':
      return <Badge variant="secondary">recusado</Badge>
    default:
      return <Badge variant="secondary">{status ?? '—'}</Badge>
  }
}

const TABS = [
  { key: 'webhook_raw', label: 'Webhook (bruto)' },
  { key: 'response_meta', label: 'Resposta Meta' },
  { key: 'response_ga4', label: 'Resposta GA4' },
] as const

function JsonView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem dados.
      </p>
    )
  }
  return (
    <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function PurchasesTable({ purchases }: { purchases: PurchaseRow[] }) {
  const [selected, setSelected] = React.useState<PurchaseRow | null>(null)
  const [tab, setTab] = React.useState<(typeof TABS)[number]['key']>(
    'webhook_raw'
  )

  if (purchases.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma compra encontrada.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
              >
                <td className="whitespace-nowrap px-3 py-2 tabular text-muted-foreground">
                  {fmtDate(p.created_at)}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2">
                  {p.produto ?? '—'}
                </td>
                <td className="px-3 py-2">{statusBadge(p.status)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.utm_source ?? '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular font-medium">
                  {p.valor !== null
                    ? formatCurrency(Number(p.valor), p.moeda)
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(p)
                      setTab('webhook_raw')
                    }}
                    aria-label="Ver detalhes"
                  >
                    <Eye />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.produto ?? 'Compra'}</DialogTitle>
            <DialogDescription>
              {selected?.transaction_id} · vínculo: {selected?.match_type ?? '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {selected && <JsonView value={selected[tab]} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
