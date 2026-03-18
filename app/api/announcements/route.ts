// app/api/announcements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateAnnouncementSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stokvelId = new URL(request.url).searchParams.get('stokvelId')
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('stokvel_id', stokvelId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ announcements: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body   = await request.json()
    const parsed = CreateAnnouncementSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { stokvelId, title, body: bodyText, type, pinned, expires_at } = parsed.data

    const { data: stokvel } = await supabase.from('stokvels').select('id').eq('id', stokvelId).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('announcements')
      .insert({ stokvel_id: stokvelId, title, body: bodyText, type, pinned, expires_at: expires_at || null, created_by: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.ANNOUNCEMENT_CREATE,
      targetType: 'announcement',
      targetId:   data.id,
      details:    { title, type },
    })

    return NextResponse.json({ announcement: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
