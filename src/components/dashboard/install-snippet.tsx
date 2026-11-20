'use client'

import * as React from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  function copy() {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-3 pr-12 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        onClick={copy}
        title="Copiar"
        className="absolute right-2 top-2"
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </div>
  )
}

export function InstallSnippet({
  offerSlug,
  offerName,
}: {
  offerSlug: string
  offerName: string
}) {
  const [origin, setOrigin] = React.useState('https://SEU-APP')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const scriptTag = `<script defer src="${origin}/t.js" data-base="${origin}" data-offer="${offerSlug}"></script>`

  const checkoutHint = `<a href="https://checkout.wiapy.com/SEU-PRODUTO?utm_content=' + window.lck.id + '">Comprar</a>

// ou, em JS, ao montar o link do checkout:
const url = 'https://checkout.wiapy.com/SEU-PRODUTO?utm_content=' + window.lck.id`

  const eventsHint = `// Dispare eventos do funil (Pixel + GA4 + CAPI, com dedup):
lck.track('ViewContent',       { content_name: 'Página de vendas' })
lck.track('InitiateCheckout',  { value: 197, currency: 'BRL' })
lck.track('Lead')

// Enriqueça o visitante quando souber e-mail/telefone (hash é no servidor):
lck.identify({ email: 'cliente@email.com', phone: '11988887777' })`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-semibold">
          1. Cole o script nas páginas da oferta {offerName}
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          No <code className="font-mono">&lt;head&gt;</code> das páginas do funil
          <b> desta oferta</b>. O <code className="font-mono">data-offer</code>{' '}
          abaixo carimba os dados na oferta <b>{offerName}</b>.
        </p>
        <CodeBlock code={scriptTag} />
      </div>

      <div>
        <h3 className="font-semibold">2. Passe o ID para o checkout da Wiapy</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Adicione <code className="font-mono">?utm_content=&lt;id&gt;</code> na
          URL do checkout. A Wiapy devolve isso no webhook e o sistema casa a
          compra com o visitante.
        </p>
        <CodeBlock code={checkoutHint} />
      </div>

      <div>
        <h3 className="font-semibold">3. Eventos do funil (opcional)</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          O <code className="font-mono">PageView</code> é disparado
          automaticamente. Para os demais, chame{' '}
          <code className="font-mono">lck.track()</code> nos cliques/etapas.
        </p>
        <CodeBlock code={eventsHint} />
      </div>
    </div>
  )
}
