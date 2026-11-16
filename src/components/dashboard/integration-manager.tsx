'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Plug, LoaderCircle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { TestResult } from '@/app/dashboard/configuracoes/actions'

export type IntegrationItem = {
  id: string
  label: string
  idValue: string
  hasSecret: boolean
}

type Actions = {
  save: (formData: FormData) => Promise<void>
  remove: (id: string) => Promise<void>
  test: (id: string) => Promise<TestResult>
}

type Labels = {
  idLabel: string
  idPlaceholder: string
  secretLabel: string
  secretPlaceholder: string
}

export function IntegrationManager({
  title,
  description,
  items,
  labels,
  actions,
}: {
  title: string
  description: string
  items: IntegrationItem[]
  labels: Labels
  actions: Actions
}) {
  const router = useRouter()
  const [dialog, setDialog] = React.useState<
    { mode: 'add' } | { mode: 'edit'; item: IntegrationItem } | null
  >(null)
  const [results, setResults] = React.useState<
    Record<string, TestResult | 'loading'>
  >({})
  const [pending, startTransition] = React.useTransition()
  const [formError, setFormError] = React.useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await actions.save(fd)
        setDialog(null)
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  function onTest(id: string) {
    setResults((r) => ({ ...r, [id]: 'loading' }))
    startTransition(async () => {
      try {
        const res = await actions.test(id)
        setResults((r) => ({ ...r, [id]: res }))
      } catch (err) {
        setResults((r) => ({
          ...r,
          [id]: {
            ok: false,
            message: err instanceof Error ? err.message : 'falha',
          },
        }))
      }
    })
  }

  function onRemove(id: string) {
    if (!confirm('Remover esta conta?')) return
    startTransition(async () => {
      await actions.remove(id)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ mode: 'add' })}>
          <Plus />
          Adicionar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Nenhuma conta cadastrada.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const res = results[item.id]
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    {item.hasSecret ? (
                      <Badge variant="secondary">segredo ••••</Badge>
                    ) : (
                      <Badge variant="warning">sem segredo</Badge>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.idValue}
                  </span>
                </div>

                {res && res !== 'loading' && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      res.ok ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {res.ok ? (
                      <Check className="size-3.5" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                    {res.message}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTest(item.id)}
                    disabled={pending}
                    title="Testar conexão"
                  >
                    {res === 'loading' ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Plug />
                    )}
                    Testar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDialog({ mode: 'edit', item })}
                    title="Editar"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    title="Remover"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit' ? 'Editar' : 'Adicionar'} — {title}
            </DialogTitle>
            <DialogDescription>
              Os segredos são cifrados no banco e lidos só no servidor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {dialog?.mode === 'edit' && (
              <input type="hidden" name="id" value={dialog.item.id} />
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Nome / rótulo</Label>
              <Input
                id="label"
                name="label"
                required
                defaultValue={
                  dialog?.mode === 'edit' ? dialog.item.label : ''
                }
                placeholder="ex.: Pixel principal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="id_value">{labels.idLabel}</Label>
              <Input
                id="id_value"
                name="id_value"
                required
                defaultValue={
                  dialog?.mode === 'edit' ? dialog.item.idValue : ''
                }
                placeholder={labels.idPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secret">{labels.secretLabel}</Label>
              <Input
                id="secret"
                name="secret"
                type="password"
                autoComplete="off"
                placeholder={
                  dialog?.mode === 'edit'
                    ? 'deixe em branco para manter o atual'
                    : labels.secretPlaceholder
                }
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
