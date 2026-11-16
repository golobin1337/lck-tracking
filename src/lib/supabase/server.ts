import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Client para Server Components / Route Handlers autenticados.
// Usa a anon key + cookies de sessão. Sujeito a RLS.
// Em Next.js 16, cookies() é assíncrono.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chamado de um Server Component: ignorável quando há proxy
            // de refresh de sessão cuidando dos cookies.
          }
        },
      },
    }
  )
}
