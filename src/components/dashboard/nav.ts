import {
  LayoutDashboard,
  Activity,
  DollarSign,
  Target,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: 'Visão geral', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Eventos', href: '/dashboard/eventos', icon: Activity },
  { label: 'Faturamento', href: '/dashboard/faturamento', icon: DollarSign },
  { label: 'Campanhas', href: '/dashboard/campanhas', icon: Target },
  { label: 'Configurações', href: '/dashboard/configuracoes', icon: Settings },
]
