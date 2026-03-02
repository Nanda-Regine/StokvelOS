// app/reports/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { ReportsClient } from '@/components/reports/ReportsClient'
import type { Contribution, StokvelMember, Stokvel } from '@/types'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) redirect('/setup')

  // All-time contributions
  const { data: contributions } = await supabase
    .from('contributions')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('date', { ascending: true })

  // Active members
  const { data: members } = await supabase
    .from('stokvel_members')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('payout_position', { ascending: true, nullsFirst: false })

  // Payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select('*, stokvel_members(name)')
    .eq('stokvel_id', stokvel.id)
    .order('date', { ascending: false })

  return (
    <ReportsClient
      stokvel={stokvel as Stokvel}
      contributions={(contributions || []) as Contribution[]}
      members={(members || []) as StokvelMember[]}
      payouts={payouts || []}
    />
  )
}
