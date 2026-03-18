// app/api/members/[id]/route.ts  (REPLACE Batch 3 version)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateMemberSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body   = await request.json()
    const parsed = UpdateMemberSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    // Verify the member belongs to admin's stokvel
    const { data: member } = await supabase
      .from('stokvel_members').select('stokvel_id, name').eq('id', params.id).single()
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase
      .from('stokvels').select('id').eq('id', member.stokvel_id).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updateData: Record<string, unknown> = {}
    const allowed = ['name','email','phone','monthly_amount','payout_position','status','role'] as const
    allowed.forEach(k => { if (parsed.data[k] !== undefined) updateData[k] = parsed.data[k] })

    const { data, error } = await supabase
      .from('stokvel_members').update(updateData).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId:  member.stokvel_id,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.MEMBER_UPDATE,
      targetType: 'member',
      targetId:   params.id,
      details:    { name: member.name, changes: Object.keys(updateData) },
    })

    return NextResponse.json({ member: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { data: member } = await supabase
      .from('stokvel_members').select('stokvel_id, name').eq('id', params.id).single()
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase
      .from('stokvels').select('id').eq('id', member.stokvel_id).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Soft delete — set status to inactive to preserve contribution history
    const { data, error } = await supabase
      .from('stokvel_members').update({ status: 'inactive' }).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId:  member.stokvel_id,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.MEMBER_REMOVE,
      targetType: 'member',
      targetId:   params.id,
      details:    { name: member.name },
    })

    return NextResponse.json({ member: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
