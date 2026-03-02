// app/contributions/page.tsx  (REPLACE Batch 3 version)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { ContributionsClient } from '@/components/contributions/ContributionsClient'

export const metadata: Metadata = { title: 'Contributions — StokvelOS' }

export default async function ContributionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  // Active members only (for payment recording)
  const { data: activeMembers } = await supabase
    .from('stokvel_members').select('*')
    .eq('stokvel_id', stokvel.id).eq('status', 'active')
    .order('payout_position', { ascending: true, nullsFirst: false })

  // Contributions — paginated to last 200 (use query param for more)
  const { data: contributions } = await supabase
    .from('contributions')
    .select(`*, stokvel_members(id, name, phone)`)
    .eq('stokvel_id', stokvel.id)
    .order('date',       { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  // Current month paid IDs (for outstanding quick-pay grid)
  const now      = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const currentMonthPaidIds = (contributions || [])
    .filter(c => c.status === 'confirmed' && c.date >= monthStr)
    .map(c => c.member_id)

  return (
    <ContributionsClient
      stokvel={stokvel}
      contributions={contributions || []}
      activeMembers={activeMembers || []}
      currentMonthPaidIds={currentMonthPaidIds}
    />
  )
}
