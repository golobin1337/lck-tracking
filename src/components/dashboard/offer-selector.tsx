'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Package } from 'lucide-react'

export type OfferOption = { id: string; name: string; slug: string }

export function OfferSelector({
  offers,
  currentOfferId,
}: {
  offers: OfferOption[]
  currentOfferId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current =
    offers.find((o) => o.id === currentOfferId) ?? offers[0] ?? null

  function select(id: string) {
    setOpen(false)
    if (id === currentOfferId) return
    // cookie de 1 ano; re-renderiza os server components com a nova oferta
    document.cookie = `lck_offer=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    router.refresh()
  }

  const letter = (current?.name?.[0] || 'O').toUpperCase()

  return (
    <div className="relative mx-2" ref={wrapRef}>
      <button
        type="button"
        onClick={() => offers.length > 0 && setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card/60 px-2.5 py-2 text-left transition-colors hover:bg-secondary/50"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {current?.name ?? 'Sem oferta'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {offers.length > 1 ? 'Trocar de oferta' : 'Oferta atual'}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
          {offers.map((o) => {
            const active = o.id === current?.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-primary/15 text-primary' : 'hover:bg-secondary'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Package className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{o.name}</span>
                </span>
                {active && <Check className="size-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
