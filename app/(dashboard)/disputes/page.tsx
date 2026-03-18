import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { DisputesClient } from '@/components/disputes/DisputesClient'

export const metadata: Metadata = { title: 'Disputes — StokvelOS' }

export default async function DisputesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const { data: disputes } = await supabase
    .from('disputes')
    .select('*, stokvel_members!complainant_id(id, name, phone)')
    .eq('stokvel_id', stokvel.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <DisputesClient
      stokvel={stokvel}
      initialDisputes={disputes ?? []}
    />
  )
}
