// app/payouts/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { PayoutsClient } from '@/components/payouts/PayoutsClient'

export const metadata: Metadata = { title: 'Payouts' }

export default async function PayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase.from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const { data: members } = await supabase
    .from('stokvel_members').select('*').eq('stokvel_id', stokvel.id)
    .eq('status', 'active').order('payout_position', { ascending: true, nullsFirst: false })

  const { data: payouts } = await supabase
    .from('payouts').select('*, stokvel_members(id, name, payout_position)')
    .eq('stokvel_id', stokvel.id).order('date', { ascending: false })

  // Current pot total (confirmed contributions)
  const { data: contribs } = await supabase
    .from('contributions').select('amount').eq('stokvel_id', stokvel.id).eq('status', 'confirmed')

  const potTotal = (contribs || []).reduce((s, c) => s + Number(c.amount), 0)
  const totalPaidOut = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)

  return (
    <PayoutsClient
      stokvel={stokvel}
      initialPayouts={payouts || []}
      members={members || []}
      potTotal={potTotal}
      totalPaidOut={totalPaidOut}
    />
  )
}
