import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/shell'
import { listOffers, getCurrentOffer } from '@/lib/offers'

export default async function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [offers, current] = await Promise.all([listOffers(), getCurrentOffer()])

  return (
    <DashboardShell offers={offers} currentOfferId={current?.id ?? null}>
      {children}
    </DashboardShell>
  )
}
