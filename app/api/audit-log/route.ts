// app/api/audit-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const stokvelId = searchParams.get('stokvelId')
    const page      = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize  = Math.min(50, Number(searchParams.get('pageSize') || 20))

    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels').select('id').eq('id', stokvelId).eq('admin_id', user.id).single()
    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error, count } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('stokvel_id', stokvelId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data, total: count, page, pageSize })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
