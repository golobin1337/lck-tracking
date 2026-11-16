import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata valores monetários (BRL por padrão).
export function formatCurrency(value: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

// Formata números com separador de milhar pt-BR.
export function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}
