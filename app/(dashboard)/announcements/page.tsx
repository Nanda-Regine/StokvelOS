// app/announcements/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { AnnouncementsClient } from '@/components/announcements/AnnouncementsClient'

export const metadata: Metadata = { title: 'Announcements' }

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase.from('stokvels').select('*').eq('admin_id', user.id).single()
  if (!stokvel) redirect('/setup')

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('pinned',      { ascending: false })
    .order('created_at',  { ascending: false })

  return <AnnouncementsClient stokvel={stokvel} initialAnnouncements={announcements || []} />
}
