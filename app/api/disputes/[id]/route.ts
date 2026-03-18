// app/api/disputes/[id]/route.ts
// GET single dispute. PATCH: admin can override state or add resolution.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateDisputeSchema = z.object({
  state:      z.enum(['open','investigating','awaiting_complainant_proof','awaiting_respondent_proof','reviewing','resolved','escalated']).optional(),
  resolution: z.string().max(1000).optional(),
  notes:      z.string().max(500).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        stokvel_members!complainant_id(id, name, phone)
      `)
      .eq('id', params.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', (data as any).stokvel_id)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ dispute: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    // Fetch dispute + verify ownership
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, stokvels!inner(admin_id)')
      .eq('id', params.id)
      .single()

    if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ((dispute as any).stokvels?.admin_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = UpdateDisputeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {}
    if (parsed.data.state !== undefined) {
      updatePayload.state = parsed.data.state
      if (parsed.data.state === 'resolved') {
        updatePayload.resolved_at = new Date().toISOString()
      }
      if (parsed.data.state === 'escalated') {
        updatePayload.escalated_at = new Date().toISOString()
      }
    }
    if (parsed.data.resolution !== undefined) updatePayload.resolution = parsed.data.resolution
    if (parsed.data.notes      !== undefined) updatePayload.notes      = parsed.data.notes

    const { data: updated, error } = await supabase
      .from('disputes')
      .update(updatePayload)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId:  (dispute as any).stokvel_id,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     'dispute.update',
      targetType: 'dispute',
      targetId:   params.id,
      details:    parsed.data,
    })

    return NextResponse.json({ dispute: updated })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
