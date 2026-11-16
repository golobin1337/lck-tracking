import type { Geo } from '@/types/database'

// IP real do cliente a partir dos headers de proxy (Vercel/edge).
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    // Primeiro IP da lista é o cliente original.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || null
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent') || null
}

// Geo a partir dos headers da Vercel (sem chamada externa, sem custo).
// Em produção na Vercel esses headers vêm preenchidos.
export function geoFromHeaders(headers: Headers): Geo {
  const country = headers.get('x-vercel-ip-country')
  const region = headers.get('x-vercel-ip-country-region')
  const cityRaw = headers.get('x-vercel-ip-city')
  const city = cityRaw ? safeDecode(cityRaw) : null
  if (country || region || city) {
    return { country: country || null, state: region || null, city }
  }
  return null
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

// IPs privados/locais não têm geo útil.
export function isPrivateIp(ip: string | null): boolean {
  if (!ip) return true
  return (
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  )
}
