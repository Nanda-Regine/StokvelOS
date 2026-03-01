import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/ReportsClient'
import type { Stokvel, StokvelMember, Contribution } from '@/types'

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

  const currentYear = new Date().getFullYear()

  const [{ data: members }, { data: contributions }, { data: payouts }] = await Promise.all([
    supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvel.id)
      .order('payout_position'),
    supabase
      .from('contributions')
      .select('*, stokvel_members(name)')
      .eq('stokvel_id', stokvel.id)
      .gte('date', `${currentYear}-01-01`)
      .order('date', { ascending: false }),
    supabase
      .from('payouts')
      .select('*, stokvel_members(name)')
      .eq('stokvel_id', stokvel.id)
      .order('date', { ascending: false }),
  ])

  return (
    <ReportsClient
      stokvel={stokvel as Stokvel}
      members={(members ?? []) as StokvelMember[]}
      contributions={(contributions ?? []) as Contribution[]}
      payouts={(payouts ?? []) as Array<Record<string, unknown>>}
    />
  )
}
