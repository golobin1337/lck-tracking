// ============================================================
// Wiapy — tipos e parse do payload do webhook de compra
// Doc: https://ajuda.wiapy.com/wiapy/produtor/integracoes/webhook
// Valores monetários vêm em CENTAVOS.
// ============================================================

export type WiapyStatus =
  | 'paid'
  | 'unpaid'
  | 'credit_card_declined'
  | 'refunded'
  | 'chargedback'

export type WiapyPayment = {
  id: string
  status: WiapyStatus
  amount: number // centavos
  payment_method?: 'pix' | 'credit_card' | 'boleto'
  type?: 'payment' | 'subscription'
  installments?: number
  fee?: number
  coupon?: string | null
  dt_create?: string
  dt_update?: string
} | null

export type WiapyCustomer = {
  id?: string | null
  name?: string | null
  email?: string | null
  mobile_phone?: string | null
  document?: string | null
}

export type WiapyCheckout = {
  id?: string
  title?: string
  amount?: number // centavos
  orderbump?: Array<{ id: string; title: string; amount: number }>
}

export type WiapyProduct = {
  id: string
  title: string
  type?: string
  itens?: Array<{ title: string; url: string }>
}

export type WiapyTracking = {
  ip?: string | null
  useragent?: string | null
  fbc?: string | null
  fbp?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
} | null

export type WiapyPayload = {
  payment: WiapyPayment
  subscription?: unknown
  customer?: WiapyCustomer
  checkout?: WiapyCheckout
  products?: WiapyProduct[] | null
  tracking?: WiapyTracking
}

// Centavos → unidade monetária (ex.: 1770 → 17.70)
export function centsToAmount(cents?: number | null): number | null {
  if (cents === undefined || cents === null) return null
  return Math.round(cents) / 100
}

// Carrinho abandonado: payment vem null.
export function isAbandonedCart(p: WiapyPayload): boolean {
  return p.payment === null || p.payment === undefined
}

// Divide nome completo em primeiro nome e sobrenome.
export function splitName(name?: string | null): {
  first: string | null
  last: string | null
} {
  if (!name) return { first: null, last: null }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return { first: null, last: null }
  const first = parts[0] || null
  const last = parts.length > 1 ? parts.slice(1).join(' ') : null
  return { first, last }
}
