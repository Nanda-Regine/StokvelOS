// app/meetings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { MeetingsClient } from '@/components/meetings/MeetingsClient'
import type { Meeting, StokvelMember, Stokvel } from '@/types'

export const metadata: Metadata = { title: 'Meetings' }

export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('*')
    .eq('admin_id', user.id)
    .single()

  if (!stokvel) redirect('/setup')

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .order('date', { ascending: false })

  const { data: members } = await supabase
    .from('stokvel_members')
    .select('*')
    .eq('stokvel_id', stokvel.id)
    .eq('status', 'active')
    .order('name')

  return (
    <MeetingsClient
      stokvel={stokvel as Stokvel}
      initialMeetings={(meetings || []) as Meeting[]}
      members={(members || []) as StokvelMember[]}
    />
  )
}
