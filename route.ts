// app/api/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('stokvel_members')
      .select('*')
      .eq('stokvel_id', stokvelId)
      .order('payout_position', { ascending: true, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ members: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { stokvelId, name, email, phone, monthly_amount, payout_position, status, role } = body

    if (!stokvelId || !name?.trim()) {
      return NextResponse.json({ error: 'stokvelId and name are required' }, { status: 400 })
    }

    // Verify user owns this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, monthly_amount')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Stokvel not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('stokvel_members')
      .insert({
        stokvel_id:      stokvelId,
        name:            name.trim(),
        email:           email?.trim() || null,
        phone:           phone?.trim() || null,
        monthly_amount:  monthly_amount ? Number(monthly_amount) : stokvel.monthly_amount,
        payout_position: payout_position ? Number(payout_position) : null,
        status:          status || 'active',
        role:            role || 'member',
        joined_at:       new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ member: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
