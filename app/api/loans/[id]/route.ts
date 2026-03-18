// app/api/loans/[id]/route.ts
// PATCH: update loan status, record repayments. GET: single loan detail.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import { z } from 'zod'

const UpdateLoanSchema = z.object({
  status:              z.enum(['pending', 'active', 'paid', 'overdue', 'defaulted']).optional(),
  balance_outstanding: z.number().min(0).optional(),
  notes:               z.string().max(500).optional(),
})

const RecordRepaymentSchema = z.object({
  amount:        z.number().positive(),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method:        z.string().max(50).optional(),
  receipt_number: z.string().max(100).optional(),
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
      .from('loans')
      .select(`
        *,
        stokvel_members(id, name, phone, compliance_rate),
        loan_repayments(id, amount, date, method, receipt_number, created_at)
      `)
      .eq('id', params.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify admin has access to this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', (data as any).stokvel_id)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ loan: data })
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

    // Fetch loan + verify ownership
    const { data: loan } = await supabase
      .from('loans')
      .select('*, stokvels!inner(admin_id)')
      .eq('id', params.id)
      .single()

    if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ((loan as any).stokvels?.admin_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Handle repayment recording separately
    if (body.repayment) {
      const repParsed = RecordRepaymentSchema.safeParse(body.repayment)
      if (!repParsed.success) {
        return NextResponse.json({ error: repParsed.error.errors[0]?.message }, { status: 400 })
      }

      const rep = repParsed.data
      const newBalance = Math.max(0, Number((loan as any).balance_outstanding) - rep.amount)
      const newStatus  = newBalance === 0 ? 'paid' : (loan as any).status

      // Insert repayment record
      await supabase.from('loan_repayments').insert({
        loan_id:        params.id,
        stokvel_id:     (loan as any).stokvel_id,
        member_id:      (loan as any).member_id,
        amount:         rep.amount,
        date:           rep.date,
        method:         rep.method ?? 'cash',
        receipt_number: rep.receipt_number ?? null,
      })

      // Update loan balance
      const { data: updatedLoan, error } = await supabase
        .from('loans')
        .update({ balance_outstanding: newBalance, status: newStatus })
        .eq('id', params.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      await writeAuditLog({
        stokvelId:  (loan as any).stokvel_id,
        actorId:    user.id,
        actorName:  profile?.full_name || user.email || 'Admin',
        action:     'loan.repayment',
        targetType: 'loan',
        targetId:   params.id,
        details:    { repaymentAmount: rep.amount, newBalance, newStatus },
      })

      return NextResponse.json({ loan: updatedLoan })
    }

    // Standard loan update
    const parsed = UpdateLoanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('loans')
      .update({
        ...(parsed.data.status              !== undefined ? { status: parsed.data.status }                           : {}),
        ...(parsed.data.balance_outstanding !== undefined ? { balance_outstanding: parsed.data.balance_outstanding } : {}),
        ...(parsed.data.notes               !== undefined ? { notes: parsed.data.notes }                             : {}),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId:  (loan as any).stokvel_id,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     'loan.update',
      targetType: 'loan',
      targetId:   params.id,
      details:    parsed.data,
    })

    return NextResponse.json({ loan: updated })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
