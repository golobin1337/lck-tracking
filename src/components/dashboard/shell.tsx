'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Menu, X, LogOut, ChevronDown } from 'lucide-react'
import { navItems } from './nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { PrizeBadge } from '@/components/dashboard/prize-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { logout } from '@/app/dashboard/actions'

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Activity className="size-5" />
      </span>
      <span className="text-base font-semibold tracking-tight">
        LCK Tracking
      </span>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
      {children}
    </p>
  )
}

// Seletor de conta/dashboard (placeholder — múltiplas ofertas virão depois).
function AccountSelector({ email }: { email: string }) {
  const letter = (email?.[0] || 'C').toUpperCase()
  return (
    <button
      type="button"
      title="Troca entre dashboards (ofertas) em breve"
      className="mx-2 flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-2.5 py-2 text-left transition-colors hover:bg-secondary/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          Conta principal
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {email}
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const active =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function ThemeRow() {
  return (
    <div className="mx-2 flex items-center justify-between rounded-md px-3 py-1.5">
      <span className="text-sm text-muted-foreground">Tema</span>
      <ThemeToggle />
    </div>
  )
}

function SidebarContent({
  email,
  onNavigate,
}: {
  email: string
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-3 pt-3">
      <AccountSelector email={email} />

      <SectionLabel>Menu principal</SectionLabel>
      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto">
        <SectionLabel>Preferências</SectionLabel>
        <ThemeRow />
        <form action={logout} className="mx-2 mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}

export function DashboardShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/40 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center border-b border-border px-2">
          <Brand />
        </div>
        <SidebarContent email={email} />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-2">
              <Brand />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <SidebarContent email={email} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/70 px-4 backdrop-blur-xl md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <Brand />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <PrizeBadge />
    </div>
  )
}
