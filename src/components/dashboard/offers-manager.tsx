'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, LoaderCircle, Check, X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createOffer,
  renameOffer,
  deleteOffer,
} from '@/app/dashboard/configuracoes/actions'

export type OfferRow = { id: string; name: string; slug: string }

export function OffersManager({
  offers,
  currentOfferId,
}: {
  offers: OfferRow[]
  currentOfferId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [newName, setNewName] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('name', newName)
    startTransition(async () => {
      try {
        await createOffer(fd)
        setNewName('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar')
      }
    })
  }

  function saveRename(id: string) {
    startTransition(async () => {
      try {
        await renameOffer(id, editName)
        setEditingId(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao renomear')
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Apagar esta oferta?')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteOffer(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao apagar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cada oferta é uma dashboard com seus próprios dados, pixels, GA4, contas
        de anúncio, token de webhook e snippet. Troque a oferta ativa no menu
        lateral.
      </p>

      <form onSubmit={create} className="flex items-end gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da nova oferta (ex.: Picolé)"
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Criar
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2">
        {offers.map((o) => {
          const active = o.id === currentOfferId
          return (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
            >
              <Package className="size-4 shrink-0 text-muted-foreground" />
              {editingId === o.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 max-w-xs"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => saveRename(o.id)}
                    disabled={pending}
                  >
                    <Check /> Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X />
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{o.name}</span>
                    {active && (
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">
                        ativa
                      </span>
                    )}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {o.slug}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Renomear"
                    onClick={() => {
                      setEditingId(o.id)
                      setEditName(o.name)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Apagar"
                    onClick={() => remove(o.id)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
