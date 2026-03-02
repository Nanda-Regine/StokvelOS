// app/api/meetings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    // Verify ownership
    const { data: meeting } = await supabase
      .from('meetings')
      .select('stokvel_id')
      .eq('id', params.id)
      .single()

    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', meeting.stokvel_id)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed = ['title', 'date', 'location', 'attendees', 'raw_notes', 'formatted_minutes', 'ai_summary']
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    allowed.forEach(k => { if (body[k] !== undefined) updateData[k] = body[k] })

    const { data, error } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ meeting: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: meeting } = await supabase
      .from('meetings')
      .select('stokvel_id')
      .eq('id', params.id)
      .single()

    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', meeting.stokvel_id)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
