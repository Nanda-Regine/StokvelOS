// app/api/cron/compliance-update/route.ts
// Vercel Cron: 6AM daily — recalculate compliance rates for all active members

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: stokvels } = await serviceClient
      .from('stokvels')
      .select('id, start_date')
      .eq('active', true)

    let totalUpdated = 0

    for (const stokvel of stokvels || []) {
      const { data: members } = await serviceClient
        .from('stokvel_members')
        .select('id, date_joined')
        .eq('stokvel_id', stokvel.id)
        .eq('status', 'active')

      for (const member of members || []) {
        const joinDate     = new Date(member.date_joined || stokvel.start_date || '2024-01-01')
        const now          = new Date()
        const monthsActive = Math.max(1, Math.floor(
          (now.getFullYear() - joinDate.getFullYear()) * 12 +
          (now.getMonth() - joinDate.getMonth()) + 1
        ))

        // Count confirmed contributions since joining
        const { count: paidCount } = await serviceClient
          .from('contributions')
          .select('id', { count: 'exact', head: true })
          .eq('stokvel_id', stokvel.id)
          .eq('member_id',  member.id)
          .in('status', ['verified', 'confirmed'])
          .gte('payment_date', joinDate.toISOString().split('T')[0])

        const complianceRate = Math.min(100, Math.round(((paidCount || 0) / monthsActive) * 100))

        await serviceClient
          .from('stokvel_members')
          .update({ compliance_rate: complianceRate })
          .eq('id', member.id)

        totalUpdated++
      }
    }

    return NextResponse.json({
      success:      true,
      totalUpdated,
      stokvelsProcessed: stokvels?.length || 0,
    })
  } catch (err) {
    console.error('[Cron/compliance-update]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
