// app/api/settings/route.ts
// PATCH stokvel settings (used by SettingsClient for server-side updates)
// Note: SettingsClient also does direct Supabase client calls for simple fields.
// This route handles validated updates that need server-side audit logging.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateStokvelSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body = await request.json()

    // stokvelId must be in body
    if (!body.stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const parsed = UpdateStokvelSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    // Verify admin owns this stokvel
    const { data: existing } = await supabase
      .from('stokvels')
      .select('id, name')
      .eq('id', body.stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Build update — only include fields that were provided
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const allowed = [
      'name', 'type', 'province', 'description',
      'monthly_amount', 'payout_frequency', 'payout_order',
      'bank_name', 'bank_account', 'bank_branch',
    ] as const

    allowed.forEach(k => {
      if ((parsed.data as Record<string, unknown>)[k] !== undefined) {
        updateData[k] = (parsed.data as Record<string, unknown>)[k]
      }
    })

    const { data, error } = await supabase
      .from('stokvels')
      .update(updateData)
      .eq('id', body.stokvelId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId:  body.stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.STOKVEL_UPDATE,
      targetType: 'stokvel',
      targetId:   body.stokvelId,
      details:    { fieldsChanged: Object.keys(updateData).filter(k => k !== 'updated_at') },
    })

    return NextResponse.json({ stokvel: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET: fetch current stokvel for settings page
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('stokvels')
      .select('*')
      .eq('admin_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ stokvel: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
