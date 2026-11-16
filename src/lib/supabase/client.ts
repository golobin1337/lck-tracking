import { createBrowserClient } from '@supabase/ssr'

// Client para uso no browser (Client Components). Usa a anon key.
// Sujeito a RLS: só lê linhas do próprio usuário autenticado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
