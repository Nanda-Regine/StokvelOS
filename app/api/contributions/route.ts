// app/api/contributions/route.ts  (REPLACE Batch 3 version)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateContributionSchema, validationError } from '@/lib/validation'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'

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

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id, name')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        stokvel_id:  stokvelId,
        member_id,
        amount,
        date,
        method,
        status,
        notes:       notes?.trim() || null,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      })
      .select('*, stokvel_members(id, name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const memberName = (data as { stokvel_members?: { name: string } | null })?.stokvel_members?.name || member_id

    await writeAuditLog({
      stokvelId,
      actorId:    user.id,
      actorName:  profile?.full_name || user.email || 'Admin',
      action:     AUDIT_ACTIONS.CONTRIBUTION_CREATE,
      targetType: 'contribution',
      targetId:   data.id,
      details:    { amount, date, method, status, memberName },
    })

    return NextResponse.json({ contribution: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
