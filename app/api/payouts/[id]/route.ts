// app/api/payouts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdatePayoutSchema, validationError } from '@/lib/validation'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await request.json()
    const parsed = UpdatePayoutSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 })

    const { data: payout } = await supabase.from('payouts').select('stokvel_id').eq('id', params.id).single()
    if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase.from('stokvels').select('id').eq('id', payout.stokvel_id).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updateData: Record<string, unknown> = {}
    const allowed = ['status', 'amount', 'date', 'notes'] as const
    allowed.forEach(k => { if (parsed.data[k] !== undefined) updateData[k] = parsed.data[k] })

    const { data, error } = await supabase.from('payouts').update(updateData).eq('id', params.id).select('*, stokvel_members(id, name)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payout: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: payout } = await supabase.from('payouts').select('stokvel_id').eq('id', params.id).single()
    if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: stokvel } = await supabase.from('stokvels').select('id').eq('id', payout.stokvel_id).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase.from('payouts').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
