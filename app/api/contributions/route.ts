// app/api/contributions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CreateContributionSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import { runFraudDetection } from '@/lib/fraud/detector'
import { syncContributionToNotion } from '@/lib/notion/workspace'

function generateReceipt(): string {
  const ts   = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `STK-${ts}-${rand}`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    const memberId  = searchParams.get('memberId')
    const month     = searchParams.get('month')
    const status    = searchParams.get('status')
    const page      = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize  = Math.min(100, Number(searchParams.get('pageSize') || 50))

    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    let query = supabase
      .from('contributions')
      .select('*, stokvel_members(id, name, phone)', { count: 'exact' })
      .eq('stokvel_id', stokvelId)
      .order('date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (memberId) query = query.eq('member_id', memberId)
    if (status)   query = query.eq('status', status)
    if (month) {
      const [year, m] = month.split('-')
      query = query
        .gte('date', `${year}-${m}-01`)
        .lte('date', new Date(Number(year), Number(m), 0).toISOString().split('T')[0])
    }

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contributions: data, total: count, page, pageSize })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const body   = await request.json()
    const parsed = CreateContributionSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { stokvelId, member_id, amount, date, method, status, notes } = parsed.data

    // Verify admin owns this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, name, notion_contributions_db_id')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const receiptNumber = generateReceipt()

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        stokvel_id:     stokvelId,
        member_id,
        amount,
        date,
        method,
        status,
        notes:          notes?.trim() || null,
        receipt_number: receiptNumber,
        recorded_by:    user.id,
        recorded_at:    new Date().toISOString(),
      })
      .select('*, stokvel_members(id, name, notion_page_id)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const memberRow = (data as any)?.stokvel_members
    const memberName = memberRow?.name || member_id

    // ── Post-insert side-effects (non-blocking) ─────────────────
    void Promise.allSettled([
      // 1. Fraud detection
      runFraudDetection({
        id:         data.id,
        stokvel_id: stokvelId,
        member_id,
        amount,
        date,
        method,
        receipt_number: receiptNumber,
      }),

      // 2. Notion sync (only if this stokvel has a Notion workspace)
      stokvel.notion_contributions_db_id
        ? syncContributionToNotion({
            stokvelId,
            memberNotionPageId:     memberRow?.notion_page_id ?? undefined,
            amount,
            date,
            method:                 method ?? 'cash',
            receiptNumber,
            status,
            notionContributionsDbId: stokvel.notion_contributions_db_id,
          })
        : Promise.resolve(),

      // 3. Update member's total_contributed
      createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
        .rpc('increment_member_total_contributed', {
          p_member_id: member_id,
          p_amount:    amount,
        })
        .then(() => {/* ignore — RPC may not exist yet */})
        .catch(() => {/* non-fatal */}),
    ])

    // Audit log
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.CONTRIBUTION_CREATE,
      targetType: 'contribution',
      targetId:   data.id,
      details:    { amount, date, method, status, memberName, receiptNumber },
    })

    return NextResponse.json({ contribution: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
