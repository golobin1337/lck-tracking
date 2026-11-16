// CORS permissivo para os endpoints públicos de captura, que são chamados
// do site de vendas (origem diferente). Não usamos cookies aqui, então '*'
// é aceitável.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function corsJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  })
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}
