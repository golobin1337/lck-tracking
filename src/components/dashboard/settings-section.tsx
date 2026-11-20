'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Copy, RefreshCw, LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  saveSettings,
  generateOfferWebhookToken,
} from '@/app/dashboard/configuracoes/actions'

export function SettingsSection({
  offerId,
  offerName,
  webhookToken,
  currency,
  testEventCode,
}: {
  offerId: string | null
  offerName: string
  webhookToken: string | null
  currency: string
  testEventCode: string | null
}) {
  const router = useRouter()
  const [token, setToken] = React.useState(webhookToken)
  const [reveal, setReveal] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [webhookUrl, setWebhookUrl] = React.useState('')

  React.useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhook/compra`)
  }, [])

  // Atualiza o token exibido ao trocar de oferta.
  React.useEffect(() => {
    setToken(webhookToken)
    setReveal(false)
  }, [webhookToken, offerId])

  function onGenerate() {
    if (!offerId) return
    startTransition(async () => {
      const t = await generateOfferWebhookToken(offerId)
      setToken(t)
      setReveal(true)
      router.refresh()
    })
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveSettings(fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const masked = token
    ? token.slice(0, 6) + '••••••••••••' + token.slice(-4)
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* Webhook token */}
      <div>
        <Label>Token do webhook (Wiapy) — oferta {offerName}</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Este token é da oferta <b>{offerName}</b>. Cadastre ele + a URL abaixo
          no checkout Wiapy <b>desta</b> oferta (header Authorization).
        </p>
        {token ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-xs">
              {reveal ? token : masked}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReveal((v) => !v)}
              title={reveal ? 'Ocultar' : 'Revelar'}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copy(token)}
              title="Copiar token"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Gerar novo
            </Button>
          </div>
        ) : (
          <Button onClick={onGenerate} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            Gerar token
          </Button>
        )}

        {webhookUrl && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">URL:</span>
            <code className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-xs">
              {webhookUrl}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copy(webhookUrl)}
              title="Copiar URL"
            >
              <Copy />
            </Button>
          </div>
        )}
      </div>

      {/* Currency + test event code */}
      <form onSubmit={onSave} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Moeda</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={currency}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="test_event_code">Test event code (Meta)</Label>
          <Input
            id="test_event_code"
            name="test_event_code"
            defaultValue={testEventCode ?? ''}
            placeholder="opcional"
            className="w-56"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </form>
    </div>
  )
}
