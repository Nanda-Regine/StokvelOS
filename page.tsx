// app/members/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { MembersClient } from './MembersClient'
import type { StokvelMember, Stokvel } from '@/types'

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

  const { data: members } = await supabase
    .from('stokvel_members')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('payout_position', { ascending: true, nullsFirst: false })

  // Current month paid member IDs
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: currentMonthContribs } = await supabase
    .from('contributions')
    .select('member_id')
    .eq('stokvel_id', stokvel.id)
    .eq('status', 'confirmed')
    .gte('date', monthStart)

  const paidIds = new Set((currentMonthContribs || []).map((c: { member_id: string }) => c.member_id))

  // Year totals per member
  const yearStart = `${now.getFullYear()}-01-01`
  const { data: yearContribsRaw } = await supabase
    .from('contributions')
    .select('member_id, amount')
    .eq('stokvel_id', stokvel.id)
    .eq('status', 'confirmed')
    .gte('date', yearStart)

  const yearContribs: Record<string, number> = {}
  ;(yearContribsRaw || []).forEach((c: { member_id: string; amount: number }) => {
    yearContribs[c.member_id] = (yearContribs[c.member_id] || 0) + Number(c.amount)
  })

  return (
    <MembersClient
      stokvel={stokvel as Stokvel}
      initialMembers={(members || []) as StokvelMember[]}
      initialPaidIds={Array.from(paidIds) as string[]}
      yearContribs={yearContribs}
    />
  )
}
