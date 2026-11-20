import 'server-only'
import { createHmac } from 'node:crypto'

// Chave estável (não armazenada) para o link compartilhável de conexão do Meta.
// Derivada de ENCRYPTION_KEY + App ID → só quem tem o link consegue conectar,
// sem precisar de login no painel. Trocar o App ID invalida links antigos.
export function metaConnectKey(appId: string): string {
  const secret = process.env.ENCRYPTION_KEY || ''
  return createHmac('sha256', secret)
    .update(`meta-connect:${appId}`)
    .digest('hex')
    .slice(0, 40)
}
