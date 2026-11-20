import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOffer } from '@/lib/offers'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsSection } from '@/components/dashboard/settings-section'
import { InstallSnippet } from '@/components/dashboard/install-snippet'
import { OffersManager } from '@/components/dashboard/offers-manager'
import { MetaConnect } from '@/components/dashboard/meta-connect'
import { metaConnectKey } from '@/lib/meta-connect-key'
import {
  IntegrationManager,
  type IntegrationItem,
  type OfferRef,
} from '@/components/dashboard/integration-manager'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const [settingsRes, offersRes, current, pixelsRes, ga4Res, adRes] =
    await Promise.all([
      supabase
        .from('settings')
        .select('currency, test_event_code, fb_app_id, fb_app_secret_enc')
        .maybeSingle(),
      supabase.from('offers').select('id, name, slug, webhook_token'),
      getCurrentOffer(),
      supabase
        .from('meta_pixels')
        .select('id, label, pixel_id, capi_token_enc, offer_id'),
      supabase
        .from('ga4_accounts')
        .select('id, label, measurement_id, api_secret_enc, offer_id'),
      supabase
        .from('meta_ad_accounts')
        .select('id, label, ad_account_id, ads_token_enc, offer_id'),
    ])

  const settings = settingsRes.data
  const offersFull = offersRes.data ?? []
  const offerRefs: OfferRef[] = offersFull.map((o) => ({
    id: o.id,
    name: o.name,
  }))
  const currentFull = offersFull.find((o) => o.id === current?.id) ?? null

  const pixels: IntegrationItem[] = (pixelsRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    idValue: p.pixel_id,
    hasSecret: !!p.capi_token_enc,
    offerId: p.offer_id ?? null,
  }))
  const ga4: IntegrationItem[] = (ga4Res.data ?? []).map((g) => ({
    id: g.id,
    label: g.label,
    idValue: g.measurement_id,
    hasSecret: !!g.api_secret_enc,
    offerId: g.offer_id ?? null,
  }))
  const adAccounts: IntegrationItem[] = (adRes.data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    idValue: a.ad_account_id,
    hasSecret: !!a.ads_token_enc,
    offerId: a.offer_id ?? null,
  }))

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Ofertas, webhook, pixels, GA4 e contas de anúncio."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ofertas (dashboards)</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <OffersManager
                offers={offersFull.map((o) => ({
                  id: o.id,
                  name: o.name,
                  slug: o.slug,
                }))}
                currentOfferId={current?.id ?? null}
              />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geral & Webhook</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsSection
              offerId={current?.id ?? null}
              offerName={current?.name ?? '—'}
              webhookToken={currentFull?.webhook_token ?? null}
              currency={settings?.currency ?? 'BRL'}
              testEventCode={settings?.test_event_code ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Instalação (script do site)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InstallSnippet
              offerSlug={current?.slug ?? ''}
              offerName={current?.name ?? '—'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <IntegrationManager
              title="Pixels Meta"
              description="Conversions API — atribua cada pixel a uma oferta."
              items={pixels}
              offers={offerRefs}
              labels={{
                idLabel: 'Pixel ID',
                idPlaceholder: '123456789012345',
                secretLabel: 'Token CAPI',
                secretPlaceholder: 'EAAB...',
              }}
              kind="pixel"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <IntegrationManager
              title="Propriedades GA4"
              description="Measurement Protocol — atribua cada GA4 a uma oferta."
              items={ga4}
              offers={offerRefs}
              labels={{
                idLabel: 'Measurement ID',
                idPlaceholder: 'G-XXXXXXXXXX',
                secretLabel: 'API Secret',
                secretPlaceholder: 'segredo da API',
              }}
              kind="ga4"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-6 pt-5">
            <div>
              <h3 className="mb-1 font-semibold">
                Contas de anúncio (Meta Ads)
              </h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Conecte pelo Facebook (recomendado) e atribua cada conta à sua
                oferta.
              </p>
              <Suspense fallback={null}>
                <MetaConnect
                  fbAppId={settings?.fb_app_id ?? null}
                  hasSecret={!!settings?.fb_app_secret_enc}
                  connectKey={
                    settings?.fb_app_id
                      ? metaConnectKey(settings.fb_app_id)
                      : null
                  }
                />
              </Suspense>
            </div>

            <div className="border-t border-border pt-5">
              <IntegrationManager
                title="Contas conectadas"
                description="Atribua cada conta à oferta correspondente."
                items={adAccounts}
                offers={offerRefs}
                labels={{
                  idLabel: 'Ad Account ID',
                  idPlaceholder: 'act_123... ou 123...',
                  secretLabel: 'Token de Ads',
                  secretPlaceholder: 'EAAB...',
                }}
                kind="ad"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
