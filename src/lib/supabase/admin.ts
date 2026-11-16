import { createClient } from '@supabase/supabase-js'

// Client com service_role — BYPASSA RLS. USAR SOMENTE NO SERVIDOR.
// Nunca importar em Client Components nem expor a key no browser.
// Usado pelos endpoints de captura/webhook para escrever nas tabelas.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
