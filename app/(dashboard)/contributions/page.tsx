import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ContributionsClient } from '@/components/contributions/ContributionsClient'
import type { Stokvel, StokvelMember, Contribution } from '@/types'

export const metadata: Metadata = { title: 'Contributions' }

export default async function ContributionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) redirect('/setup')

  const [{ data: contributions }, { data: members }] = await Promise.all([
    supabase
      .from('contributions')
      .select('*, member:stokvel_members(name, email)')
      .eq('stokvel_id', stokvel.id)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvel.id)
      .eq('status', 'active')
      .order('name'),
  ])

  return (
    <ContributionsClient
      stokvel={stokvel as Stokvel}
      initialContributions={(contributions ?? []) as Contribution[]}
      members={(members ?? []) as StokvelMember[]}
    />
  )
}
