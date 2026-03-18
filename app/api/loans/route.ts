// app/api/loans/route.ts
// CRUD for stokvel loans. Enforces constitution-based eligibility before approval.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import { checkLoanEligibility, calculateLoanSchedule, loadRules } from '@/lib/compliance/enforcer'
import { z } from 'zod'

const CreateLoanSchema = z.object({
  stokvelId:       z.string().uuid(),
  member_id:       z.string().uuid(),
  amount:          z.number().positive(),
  interest_rate:   z.number().min(0).max(100).optional(),
  start_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:           z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    const memberId  = searchParams.get('memberId')
    const status    = searchParams.get('status')

    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    let query = supabase
      .from('loans')
      .select('*, stokvel_members(id, name, phone)', { count: 'exact' })
      .eq('stokvel_id', stokvelId)
      .order('created_at', { ascending: false })

    if (memberId) query = query.eq('member_id', memberId)
    if (status)   query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ loans: data, total: count })
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
    const parsed = CreateLoanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Validation error' }, { status: 400 })
    }

    const { stokvelId, member_id, amount, interest_rate, start_date, end_date, notes } = parsed.data

    // Verify admin owns this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, name, monthly_amount, extracted_rules')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Check loan eligibility against constitution rules
    const rules       = await loadRules(stokvelId)
    const eligibility = await checkLoanEligibility(member_id, stokvelId, amount, rules)

    if (!eligibility.eligible) {
      return NextResponse.json({
        error:  'Loan not eligible',
        reason: eligibility.reasons[0] ?? 'Not eligible',
      }, { status: 422 })
    }

    // Calculate repayment schedule
    const effectiveRate = interest_rate ?? rules.interest_rate_percent
    const months        = Math.max(1, Math.round(
      (new Date(end_date).getTime() - new Date(start_date).getTime()) / (30 * 24 * 60 * 60 * 1000)
    ))
    const schedule      = calculateLoanSchedule(amount, { ...rules, interest_rate_percent: effectiveRate }, months)

    const { data, error } = await supabase
      .from('loans')
      .insert({
        stokvel_id:          stokvelId,
        member_id,
        amount,
        interest_rate:       effectiveRate,
        total_repayable:     schedule.totalRepayable,
        balance_outstanding: schedule.totalRepayable,
        start_date,
        end_date,
        status:              'active',
        notes:               notes?.trim() || null,
      })
      .select('*, stokvel_members(id, name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const memberName = (data as any)?.stokvel_members?.name || member_id
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     'loan.create',
      targetType: 'loan',
      targetId:   data.id,
      details:    { amount, effectiveRate, totalRepayable: schedule.totalRepayable, memberName },
    })

    return NextResponse.json({ loan: data, schedule })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
