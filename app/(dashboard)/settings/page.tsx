import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/SettingsClient'
import type { Stokvel } from '@/types'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: stokvel },
    { data: profile },
    { data: subscription },
  ] = await Promise.all([
    supabase.from('stokvels').select('*').eq('admin_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
  ])

  if (!stokvel) redirect('/setup')

  return (
    <SettingsClient
      stokvel={stokvel as Stokvel}
      profile={profile}
      subscription={subscription}
      userId={user.id}
      userEmail={user.email ?? ''}
    />
  )
}
