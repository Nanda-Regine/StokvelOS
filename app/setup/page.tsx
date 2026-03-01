import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/SettingsClient'

export const metadata: Metadata = {
  title: 'Set up your stokvel',
  robots: { index: false },
}

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // If stokvel already exists, redirect to dashboard
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('id')
    .eq('admin_id', user.id)
    .single()

  if (stokvel) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-deep-900 via-forest-900 to-deep-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-earth-500 flex items-center justify-center font-bold text-white">S</div>
            <span className="text-white font-semibold text-xl">StokvelOS</span>
          </div>
        </div>
        <SettingsClient
          stokvel={null}
          profile={profile}
          subscription={null}
          userId={user.id}
          userEmail={user.email ?? ''}
        />
      </div>
    </div>
  )
}
