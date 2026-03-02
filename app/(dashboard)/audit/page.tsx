// app/audit/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { AuditClient } from '@/components/audit/AuditClient'

export const metadata: Metadata = { title: 'Audit Log' }

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase.from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const { data: entries, count } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('stokvel_id', stokvel.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <AuditClient stokvelId={stokvel.id} initialEntries={entries || []} total={count || 0} />
}
