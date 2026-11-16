import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsSection } from '@/components/dashboard/settings-section'
import {
  IntegrationManager,
  type IntegrationItem,
} from '@/components/dashboard/integration-manager'
import {
  savePixel,
  deletePixel,
  testPixel,
  saveGa4,
  deleteGa4,
  testGa4,
  saveAdAccount,
  deleteAdAccount,
  testAdAccount,
} from './actions'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const [settingsRes, pixelsRes, ga4Res, adRes] = await Promise.all([
    supabase
      .from('settings')
      .select('webhook_token, currency, test_event_code')
      .maybeSingle(),
    supabase.from('meta_pixels').select('id, label, pixel_id, capi_token_enc'),
    supabase
      .from('ga4_accounts')
      .select('id, label, measurement_id, api_secret_enc'),
    supabase
      .from('meta_ad_accounts')
      .select('id, label, ad_account_id, ads_token_enc'),
  ])

  const settings = settingsRes.data

  const pixels: IntegrationItem[] = (pixelsRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    idValue: p.pixel_id,
    hasSecret: !!p.capi_token_enc,
  }))
  const ga4: IntegrationItem[] = (ga4Res.data ?? []).map((g) => ({
    id: g.id,
    label: g.label,
    idValue: g.measurement_id,
    hasSecret: !!g.api_secret_enc,
  }))
  const adAccounts: IntegrationItem[] = (adRes.data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    idValue: a.ad_account_id,
    hasSecret: !!a.ads_token_enc,
  }))

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Webhook, pixels Meta, propriedades GA4 e contas de anúncio."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geral & Webhook</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsSection
              webhookToken={settings?.webhook_token ?? null}
              currency={settings?.currency ?? 'BRL'}
              testEventCode={settings?.test_event_code ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <IntegrationManager
              title="Pixels Meta"
              description="Conversions API — eventos vão para todos os pixels ativos."
              items={pixels}
              labels={{
                idLabel: 'Pixel ID',
                idPlaceholder: '123456789012345',
                secretLabel: 'Token CAPI',
                secretPlaceholder: 'EAAB...',
              }}
              actions={{ save: savePixel, remove: deletePixel, test: testPixel }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <IntegrationManager
              title="Propriedades GA4"
              description="Measurement Protocol — usado na compra do webhook."
              items={ga4}
              labels={{
                idLabel: 'Measurement ID',
                idPlaceholder: 'G-XXXXXXXXXX',
                secretLabel: 'API Secret',
                secretPlaceholder: 'segredo da API',
              }}
              actions={{ save: saveGa4, remove: deleteGa4, test: testGa4 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <IntegrationManager
              title="Contas de anúncio (Meta Ads)"
              description="Insights de campanhas para ROAS e CPA."
              items={adAccounts}
              labels={{
                idLabel: 'Ad Account ID',
                idPlaceholder: 'act_123... ou 123...',
                secretLabel: 'Token de Ads',
                secretPlaceholder: 'EAAB...',
              }}
              actions={{
                save: saveAdAccount,
                remove: deleteAdAccount,
                test: testAdAccount,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
