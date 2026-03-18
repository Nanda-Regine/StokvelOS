import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { RiskClient } from '@/components/risk/RiskClient'

export const metadata: Metadata = { title: 'Risk Monitor — StokvelOS' }

export default async function RiskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const { data: snapshots } = await supabase
    .from('risk_snapshots')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('snapshot_date', { ascending: false })
    .limit(30)

  return (
    <RiskClient
      stokvel={stokvel}
      snapshots={snapshots ?? []}
    />
  )
}
