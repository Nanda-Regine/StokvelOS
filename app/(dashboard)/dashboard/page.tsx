import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { Stokvel, StokvelMember, Contribution, DashboardStats } from '@/types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) redirect('/setup')

  const now          = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const monthStart   = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`

  const [
    { data: members },
    { data: allContributions },
    { data: monthContributions },
  ] = await Promise.all([
    supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvel.id)
      .eq('status', 'active')
      .order('payout_position'),
    supabase
      .from('contributions')
      .select('*, stokvel_members(name)')
      .eq('stokvel_id', stokvel.id)
      .gte('date', `${currentYear}-01-01`)
      .order('date', { ascending: false }),
    supabase
      .from('contributions')
      .select('member_id, amount, status')
      .eq('stokvel_id', stokvel.id)
      .gte('date', monthStart)
      .eq('status', 'confirmed'),
  ])

  const safeMembers       = (members ?? []) as StokvelMember[]
  const safeContributions = (allContributions ?? []) as Contribution[]

  // ── Compute stats ──────────────────────────────────────────
  const potTotal         = safeContributions.filter(c => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0)
  const paidThisMonth    = monthContributions?.reduce((s, c) => s + (c.amount ?? 0), 0) ?? 0
  const paidIds          = Array.from(new Set(monthContributions?.map(c => c.member_id) ?? [])) as string[]
  const memberCount      = safeMembers.length
  const totalThisMonth   = safeMembers.reduce((s, m) => s + (m.monthly_amount ?? stokvel.monthly_amount), 0)
  const complianceRate   = memberCount ? Math.round((paidIds.length / memberCount) * 100) : 0
  const yearlyTarget     = totalThisMonth * 12
  const yearlyCollected  = potTotal
  const outstandingCount = memberCount - paidIds.length

  const nextPayout = safeMembers.find(m => !paidIds.includes(m.id)) ?? null

  const stats: DashboardStats = {
    potTotal,
    memberCount,
    paidThisMonth,
    totalThisMonth,
    complianceRate,
    nextPayout,
    outstandingCount,
    yearlyTarget,
    yearlyCollected,
  }

  const outstandingMembers = safeMembers
    .filter(m => !paidIds.includes(m.id))
    .map(m => ({
      id:     m.id,
      name:   m.name,
      amount: m.monthly_amount ?? stokvel.monthly_amount,
      phone:  m.phone,
      status: 'outstanding' as const,
    }))

  return (
    <DashboardClient
      stokvel={stokvel as Stokvel}
      members={safeMembers}
      contributions={safeContributions}
      stats={stats}
      outstandingMembers={outstandingMembers}
      paidIds={paidIds}
    />
  )
}
