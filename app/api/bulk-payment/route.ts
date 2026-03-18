import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BulkPaymentSchema, validationError } from '@/lib/validation'
import { checkBulkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkBulkRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body   = await request.json()
    const parsed = BulkPaymentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { stokvelId, memberIds, amount, date, method, status, notes } = parsed.data

    // Verify admin owns this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, name, monthly_amount')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch member amounts if no custom amount provided
    let memberAmounts: Record<string, number> = {}
    if (!amount) {
      const { data: members } = await supabase
        .from('stokvel_members')
        .select('id, monthly_amount')
        .eq('stokvel_id', stokvelId)
        .in('id', memberIds)

      memberAmounts = Object.fromEntries(
        (members ?? []).map(m => [m.id, m.monthly_amount ?? stokvel.monthly_amount])
      )
    }

    const now = new Date().toISOString()
    const rows = memberIds.map(memberId => ({
      stokvel_id:  stokvelId,
      member_id:   memberId,
      amount:      amount ?? memberAmounts[memberId] ?? stokvel.monthly_amount,
      date,
      method,
      status,
      notes:       notes?.trim() || null,
      recorded_by: user.id,
      recorded_at: now,
    }))

    const { data, error } = await supabase
      .from('contributions')
      .insert(rows)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.CONTRIBUTION_BULK,
      targetType: 'contribution',
      details:    { count: data?.length ?? 0, date, method, status },
    })

    return NextResponse.json({ inserted: data?.length ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
