// app/api/disputes/route.ts
// List disputes for a stokvel. Admins see all; used by dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkApiRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkApiRateLimit(user.id)
    if (!rl.success) return rateLimitResponse(rl)

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    const state     = searchParams.get('state')

    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let query = supabase
      .from('disputes')
      .select(`
        *,
        stokvel_members!complainant_id(id, name, phone)
      `, { count: 'exact' })
      .eq('stokvel_id', stokvelId)
      .order('created_at', { ascending: false })

    if (state) query = query.eq('state', state)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ disputes: data, total: count })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
