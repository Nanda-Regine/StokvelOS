// app/settings/page.tsx  (REPLACE Batch 4 version — fetches constitution + bank fields)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { SettingsClient } from '@/components/settings/SettingsClient'

export const metadata: Metadata = { title: 'Settings — StokvelOS' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch stokvel with all fields including new ones from schema-patch
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*, constitution, bank_name, bank_account, bank_branch')
    .eq('admin_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Subscription from subscriptions table (created in Batch 2 schema)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  return (
    <SettingsClient
      stokvel={stokvel}
      profile={profile}
      subscription={subscription}
      userId={user.id}
      userEmail={user.email || ''}
    />
  )
}
