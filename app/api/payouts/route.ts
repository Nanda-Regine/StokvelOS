// app/api/payouts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreatePayoutSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import { syncPayoutToNotion } from '@/lib/notion/workspace'

function generateReceipt(): string {
  const ts   = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PAY-${ts}-${rand}`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('payouts')
      .select('*, stokvel_members(id, name, phone, payout_position)')
      .eq('stokvel_id', stokvelId)
      .order('date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payouts: data })
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
    const parsed = CreatePayoutSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { stokvelId, member_id, amount, date, status, notes } = parsed.data

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, name, notion_payouts_db_id')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const receiptNumber = generateReceipt()

    const { data, error } = await supabase
      .from('payouts')
      .insert({
        stokvel_id:     stokvelId,
        member_id,
        amount,
        date,
        status,
        notes:          notes?.trim() || null,
        receipt_number: receiptNumber,
      })
      .select('*, stokvel_members(id, name, notion_page_id)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const memberRow  = (data as any)?.stokvel_members
    const memberName = memberRow?.name || member_id

    // ── Non-blocking side-effects ───────────────────────────────
    void Promise.allSettled([
      stokvel.notion_payouts_db_id
        ? syncPayoutToNotion({
            memberNotionPageId: memberRow?.notion_page_id ?? undefined,
            amount,
            date,
            receiptNumber,
            notes:              notes?.trim() || undefined,
            notionPayoutsDbId:  stokvel.notion_payouts_db_id,
          })
        : Promise.resolve(),
    ])

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.PAYOUT_CREATE,
      targetType: 'payout',
      targetId:   data.id,
      details:    { amount, date, status, memberName, receiptNumber },
    })

    return NextResponse.json({ payout: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
