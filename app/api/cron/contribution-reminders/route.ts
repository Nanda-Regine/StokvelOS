// app/api/cron/contribution-reminders/route.ts
// Vercel Cron: 9AM daily — send reminders to members due in 3 days

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText, normalisePhone } from '@/lib/whatsapp/360dialog'

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
    const today = new Date()
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const dueDayTarget = in3Days.getDate()

    // Get all active stokvels with WhatsApp numbers
    const { data: stokvels } = await serviceClient
      .from('stokvels')
      .select('id, name, monthly_amount, contribution_due_day, whatsapp_number')
      .eq('active', true)
      .not('whatsapp_number', 'is', null)

    let totalSent = 0
    const results: { stokvelId: string; sent: number }[] = []

    for (const stokvel of stokvels || []) {
      const dueDay = stokvel.contribution_due_day || 1
      if (dueDay !== dueDayTarget) continue

      // Get active members who haven't paid this month yet
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

      const { data: members } = await serviceClient
        .from('stokvel_members')
        .select('id, name, phone, monthly_amount')
        .eq('stokvel_id', stokvel.id)
        .eq('status', 'active')
        .not('phone', 'is', null)

      const { data: paid } = await serviceClient
        .from('contributions')
        .select('member_id')
        .eq('stokvel_id', stokvel.id)
        .in('status', ['verified', 'confirmed'])
        .gte('payment_date', monthStart)

      const paidIds = new Set((paid || []).map(p => p.member_id))
      const unpaid  = (members || []).filter(m => !paidIds.has(m.id))

      let sentCount = 0
      for (const member of unpaid) {
        const amount   = member.monthly_amount || stokvel.monthly_amount
        const dueDate  = `${in3Days.getDate()} ${in3Days.toLocaleString('en-ZA', { month: 'long' })}`
        const message  = `Hi ${member.name.split(' ')[0]}! Your ${stokvel.name} contribution of R${amount} is due on ${dueDate}. Reply "PAID R${amount}" once you've paid.`

        const sent = await sendWhatsAppText(member.phone, message)
        if (sent) sentCount++
      }

      if (sentCount > 0) {
        results.push({ stokvelId: stokvel.id, sent: sentCount })
        totalSent += sentCount
      }
    }

    return NextResponse.json({ success: true, totalSent, stokvelsProcessed: results.length, results })
  } catch (err) {
    console.error('[Cron/contribution-reminders]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
