import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { Stokvel, StokvelMember, Contribution, Announcement, DashboardStats } from '@/types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const now        = new Date()
  const yearStart  = `${now.getFullYear()}-01-01`
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: members },
    { data: yearContribs },
    { data: monthContribs },
    { data: recentContribs },
    { data: announcements },
  ] = await Promise.all([
    supabase.from('stokvel_members').select('*')
      .eq('stokvel_id', stokvel.id).eq('status', 'active').order('payout_position'),
    supabase.from('contributions').select('amount')
      .eq('stokvel_id', stokvel.id).gte('date', yearStart).eq('status', 'confirmed'),
    supabase.from('contributions').select('member_id, amount')
      .eq('stokvel_id', stokvel.id).gte('date', monthStart).eq('status', 'confirmed'),
    supabase.from('contributions').select('*, stokvel_members(name)')
      .eq('stokvel_id', stokvel.id).order('date', { ascending: false }).limit(6),
    supabase.from('announcements').select('*')
      .eq('stokvel_id', stokvel.id).order('created_at', { ascending: false }).limit(5),
  ])

  const safeMembers = (members ?? []) as StokvelMember[]
  const memberCount = safeMembers.length
  const paidIds     = Array.from(new Set((monthContribs ?? []).map(c => c.member_id as string)))
  const paidThisMonth  = (monthContribs ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalThisMonth = safeMembers.reduce((s, m) => s + (m.monthly_amount ?? stokvel.monthly_amount), 0)
  const potTotal       = (yearContribs ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)

  const stats: DashboardStats = {
    potTotal,
    memberCount,
    paidThisMonth,
    totalThisMonth,
    complianceRate:  memberCount ? Math.round((paidIds.length / memberCount) * 100) : 0,
    nextPayout:      safeMembers.find(m => !paidIds.includes(m.id)) ?? null,
    outstandingCount: memberCount - paidIds.length,
    yearlyTarget:    totalThisMonth * 12,
    yearlyCollected: potTotal,
  }

  return (
    <DashboardClient
      stokvel={stokvel as Stokvel}
      stats={stats}
      recentContribs={(recentContribs ?? []) as Contribution[]}
      activeMembers={safeMembers}
      announcements={(announcements ?? []) as Announcement[]}
    />
  )
}
