import { createHash } from 'node:crypto'

// SHA-256 hex de um valor já normalizado.
function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

// Normalização conforme regras de Advanced Matching da Meta:
// minúsculas, sem espaços nas pontas.
function norm(value?: string | null): string | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  return v.length ? v : null
}

export function hashEmail(email?: string | null): string | undefined {
  const v = norm(email)
  return v ? sha256(v) : undefined
}

// Telefone: só dígitos (idealmente com código do país). Hash SHA-256.
export function hashPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  return digits.length ? sha256(digits) : undefined
}

// Nome, cidade, estado, país, external_id etc. → normaliza e hasheia.
export function hashText(value?: string | null): string | undefined {
  const v = norm(value)
  return v ? sha256(v) : undefined
}

// Normaliza telefone para dígitos (para guardar em phone, não hash).
export function digitsOnly(phone?: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  return d.length ? d : null
}
