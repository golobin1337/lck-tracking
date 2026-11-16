import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Next.js 16: arquivo "proxy" substitui "middleware". Runtime nodejs.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Roda em todas as rotas, exceto estáticos e os endpoints públicos de API
  // (captura/webhook precisam responder independente de sessão).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
