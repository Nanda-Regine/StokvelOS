import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import type { Stokvel } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: stokvel } = await supabase.from('stokvels').select('*').eq('admin_id', user.id).single()
  const { data: profile  } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
  return (
    <div className="app-layout">
      <Sidebar stokvel={stokvel as Stokvel | null} userName={profile?.full_name || profile?.email} />
      <main className="main-content">{children}</main>
    </div>
  )
}
