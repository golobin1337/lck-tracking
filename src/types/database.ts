// Tipos do banco. Mantidos à mão para refletir supabase/migrations.
// Podem ser regenerados futuramente com: supabase gen types typescript.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Geo = {
  country?: string | null
  state?: string | null
  city?: string | null
} | null

export interface Settings {
  id: string
  user_id: string
  webhook_token: string | null
  currency: string
  test_event_code: string | null
  created_at: string
  updated_at: string
}

export interface Ga4Account {
  id: string
  user_id: string
  label: string
  measurement_id: string
  api_secret_enc: string | null
  active: boolean
  created_at: string
}

export interface MetaPixel {
  id: string
  user_id: string
  label: string
  pixel_id: string
  capi_token_enc: string | null
  active: boolean
  created_at: string
}

export interface MetaAdAccount {
  id: string
  user_id: string
  label: string
  ad_account_id: string
  ads_token_enc: string | null
  active: boolean
  created_at: string
}

export interface Visitor {
  id: string
  user_id: string
  trck_user_id: string
  email: string | null
  email_hash: string | null
  phone: string | null
  phone_hash: string | null
  name_hash: string | null
  fbp: string | null
  fbc: string | null
  ga_client_id: string | null
  ga_session_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  ip: string | null
  user_agent: string | null
  geo: Geo
  pixel_id: string | null
  created_at: string
  updated_at: string
}

export interface EventLog {
  id: string
  user_id: string
  trck_user_id: string | null
  event_name: string
  event_id: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  payload_meta: Json | null
  response_meta: Json | null
  payload_ga4: Json | null
  response_ga4: Json | null
  ip: string | null
  geo: Geo
  created_at: string
}

export interface Purchase {
  id: string
  user_id: string
  transaction_id: string
  trck_user_id: string | null
  email: string | null
  email_hash: string | null
  phone: string | null
  phone_hash: string | null
  produto: string | null
  valor: number | null
  moeda: string
  status: string | null
  payment_method: string | null
  installments: number | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  fbp: string | null
  fbc: string | null
  geo: Geo
  match_type: string | null
  meta_event_id: string | null
  response_meta: Json | null
  ga_client_id: string | null
  response_ga4: Json | null
  conversion_sent: boolean
  webhook_raw: Json | null
  created_at: string
  updated_at: string
}
