// app/api/statements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkExportRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkExportRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { searchParams } = new URL(request.url)
    const memberId  = searchParams.get('memberId')
    const stokvelId = searchParams.get('stokvelId')
    if (!memberId || !stokvelId) return NextResponse.json({ error: 'memberId and stokvelId required' }, { status: 400 })

    // Verify admin owns this stokvel
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('*')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: member } = await supabase
      .from('stokvel_members')
      .select('*')
      .eq('id', memberId)
      .eq('stokvel_id', stokvelId)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const { data: contributions } = await supabase
      .from('contributions')
      .select('*')
      .eq('member_id', memberId)
      .eq('stokvel_id', stokvelId)
      .order('date', { ascending: false })

    const { data: payouts } = await supabase
      .from('payouts')
      .select('*')
      .eq('member_id', memberId)
      .eq('stokvel_id', stokvelId)
      .order('date', { ascending: false })

    const totalConfirmed = (contributions || [])
      .filter(c => c.status === 'confirmed')
      .reduce((s, c) => s + Number(c.amount), 0)

    const totalPaid = (payouts || [])
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount), 0)

    return NextResponse.json({
      stokvel,
      member,
      contributions: contributions || [],
      payouts:       payouts       || [],
      summary: {
        totalConfirmed,
        totalPaid,
        balance: totalConfirmed - totalPaid,
        paymentCount: contributions?.length || 0,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
