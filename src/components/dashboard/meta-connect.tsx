'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, LoaderCircle, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveMetaApp } from '@/app/dashboard/configuracoes/actions'

const MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Conta(s) de anúncio conectada(s) com sucesso!' },
  cancelled: { ok: false, text: 'Você cancelou a conexão no Facebook.' },
  no_app: { ok: false, text: 'Salve o App ID e o App Secret antes de conectar.' },
  no_secret: { ok: false, text: 'App Secret ausente. Salve novamente.' },
  bad_state: { ok: false, text: 'Falha de segurança (state). Tente de novo.' },
  token_error: {
    ok: false,
    text: 'Não consegui trocar o código por token. Confira App ID/Secret e a URL de callback autorizada.',
  },
  accounts_error: { ok: false, text: 'Erro ao listar as contas de anúncio.' },
  no_accounts: { ok: false, text: 'Nenhuma conta de anúncio encontrada nessa conta do Facebook.' },
  exception: { ok: false, text: 'Erro inesperado na conexão.' },
}

export function MetaConnect({
  fbAppId,
  hasSecret,
}: {
  fbAppId: string | null
  hasSecret: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('meta')
  const msg = status ? MESSAGES[status] : null

  const [pending, startTransition] = React.useTransition()
  const [saved, setSaved] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [callbackUrl, setCallbackUrl] = React.useState('')

  React.useEffect(() => {
    setCallbackUrl(`${window.location.origin}/api/meta/callback`)
  }, [])

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveMetaApp(fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  const configured = !!fbAppId && hasSecret

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Conecte sua conta de anúncios pelo login oficial do Facebook (como a
        Utmify) — gera um token válido e evita o erro “API access blocked”.
      </p>

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.ok
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 1) Credenciais do App */}
      <form onSubmit={onSave} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb_app_id">App ID</Label>
            <Input
              id="fb_app_id"
              name="fb_app_id"
              defaultValue={fbAppId ?? ''}
              placeholder="123456789012345"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb_app_secret">App Secret</Label>
            <Input
              id="fb_app_secret"
              name="fb_app_secret"
              type="password"
              autoComplete="off"
              placeholder={
                hasSecret ? 'deixe em branco para manter' : 'segredo do app'
              }
            />
          </div>
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {saved ? 'Salvo!' : 'Salvar credenciais'}
          </Button>
        </div>
      </form>

      {/* URL de callback para autorizar no app */}
      {callbackUrl && (
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="mb-1 text-xs text-muted-foreground">
            No seu app do Facebook → Login do Facebook → Configurações →
            <b> URIs de redirecionamento do OAuth válidos</b>, adicione:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-xs">
              {callbackUrl}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard?.writeText(callbackUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              title="Copiar"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      {/* 2) Conectar */}
      <div>
        <Button asChild disabled={!configured}>
          <a href={configured ? '/api/meta/connect' : undefined}>
            <LogIn />
            Conectar com Facebook
          </a>
        </Button>
        {!configured && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Salve o App ID e o App Secret para habilitar a conexão.
          </p>
        )}
      </div>
    </div>
  )
}
