import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { LoansClient } from '@/components/loans/LoansClient'

export const metadata: Metadata = { title: 'Loans — StokvelOS' }

export default async function LoansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const [{ data: loans }, { data: members }] = await Promise.all([
    supabase
      .from('loans')
      .select('*, stokvel_members(id, name, phone)')
      .eq('stokvel_id', stokvel.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('stokvel_members')
      .select('id, name, phone')
      .eq('stokvel_id', stokvel.id)
      .eq('status', 'active')
      .order('name'),
  ])

  return (
    <LoansClient
      stokvel={stokvel}
      initialLoans={loans ?? []}
      activeMembers={members ?? []}
    />
  )
}
