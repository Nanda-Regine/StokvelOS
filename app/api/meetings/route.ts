// app/api/meetings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('stokvel_id', stokvelId)
      .order('date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ meetings: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { stokvelId, title, date, location, attendees, raw_notes } = body

    if (!stokvelId || !title?.trim() || !date) {
      return NextResponse.json({ error: 'stokvelId, title and date are required' }, { status: 400 })
    }

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        stokvel_id:  stokvelId,
        title:       title.trim(),
        date,
        location:    location?.trim() || null,
        attendees:   attendees || [],
        raw_notes:   raw_notes?.trim() || null,
        created_by:  user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ meeting: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
