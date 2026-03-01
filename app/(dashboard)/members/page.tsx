import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MembersClient } from '@/components/members/MembersClient'
import type { Stokvel, StokvelMember } from '@/types'

export const metadata: Metadata = { title: 'Members' }

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) redirect('/setup')

  const currentYear  = new Date().getFullYear()
  const monthStart   = `${currentYear}-01-01`

  const [{ data: members }, { data: yearContribRows }] = await Promise.all([
    supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvel.id)
      .order('name'),
    supabase
      .from('contributions')
      .select('member_id, amount, status, date')
      .eq('stokvel_id', stokvel.id)
      .gte('date', monthStart)
      .eq('status', 'confirmed'),
  ])

  // Compute current month paid IDs
  const now         = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const initialPaidIds = Array.from(
    new Set(
      (yearContribRows ?? [])
        .filter(c => c.date?.startsWith(monthPrefix))
        .map(c => c.member_id as string)
    )
  )

  // Compute year-to-date contributions per member
  const yearContribs: Record<string, number> = {}
  for (const c of yearContribRows ?? []) {
    if (c.member_id) {
      yearContribs[c.member_id as string] = (yearContribs[c.member_id as string] ?? 0) + (c.amount ?? 0)
    }
  }

  return (
    <MembersClient
      stokvel={stokvel as Stokvel}
      initialMembers={(members ?? []) as StokvelMember[]}
      initialPaidIds={initialPaidIds}
      yearContribs={yearContribs}
    />
  )
}
