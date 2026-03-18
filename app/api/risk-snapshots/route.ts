// app/api/risk-snapshots/route.ts
// Returns the latest N daily risk snapshots for a stokvel.

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
    const limit     = Math.min(90, Number(searchParams.get('limit') || 30))

    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('id')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('risk_snapshots')
      .select('*')
      .eq('stokvel_id', stokvelId)
      .order('snapshot_date', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ snapshots: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
