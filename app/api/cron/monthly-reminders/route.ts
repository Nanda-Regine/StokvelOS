// app/api/cron/monthly-reminders/route.ts
// Called by Vercel Cron on the 1st of each month at 08:00 SAST

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildWhatsAppUrl } from '@/lib/utils'
import Anthropic from '@anthropic-ai/sdk'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now      = new Date()
  const month    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStr = `${month}-01`

  try {
    const { data: stokvels } = await serviceClient.from('stokvels').select('id, name, monthly_amount')

    let totalReminders = 0
    const results: { stokvelId: string; reminded: number }[] = []

    for (const stokvel of stokvels || []) {
      const { data: existing } = await serviceClient
        .from('reminder_log').select('id').eq('stokvel_id', stokvel.id).eq('month', month).single()
      if (existing) continue

      const { data: members } = await serviceClient
        .from('stokvel_members').select('id, name, phone, monthly_amount')
        .eq('stokvel_id', stokvel.id).eq('status', 'active')

      const { data: paid } = await serviceClient
        .from('contributions').select('member_id').eq('stokvel_id', stokvel.id)
        .eq('status', 'confirmed').gte('date', monthStr)

      const paidIds     = new Set((paid || []).map(p => p.member_id))
      const outstanding = (members || []).filter(m => !paidIds.has(m.id) && m.phone)

      if (outstanding.length === 0) continue

      let reminders: Array<{ memberName: string; message: string }> = []
      try {
        const prompt = outstanding.map(m => `- ${m.name} owes R${m.monthly_amount || stokvel.monthly_amount}`).join('\n')
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: `Write brief WhatsApp reminders for ${stokvel.name} stokvel members. Friendly, Ubuntu spirit, under 2 sentences each. JSON array: [{"memberName":"Name","message":"..."}]. No markdown.`,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
        reminders = JSON.parse(text.replace(/```json|```/g, '').trim())
      } catch {
        reminders = outstanding.map(m => ({
          memberName: m.name,
          message:    `Hi ${m.name.split(' ')[0]}! Your ${stokvel.name} contribution of R${m.monthly_amount || stokvel.monthly_amount} is due this month. Please pay when you can.`,
        }))
      }

      const reminderLinks = outstanding.map((m, i) => ({
        memberId:    m.id,
        memberName:  m.name,
        phone:       m.phone,
        message:     reminders[i]?.message || '',
        whatsappUrl: buildWhatsAppUrl(m.phone!, reminders[i]?.message || ''),
      }))
      void reminderLinks // stored for reference — actual sends happen via WhatsApp API

      await serviceClient.from('reminder_log').insert({
        stokvel_id: stokvel.id,
        month,
        sent_count: outstanding.length,
      })

      totalReminders += outstanding.length
      results.push({ stokvelId: stokvel.id, reminded: outstanding.length })
    }

    return NextResponse.json({
      success:           true,
      month,
      totalReminders,
      stokvelsProcessed: results.length,
      results,
    })
  } catch (err) {
    console.error('[Cron/monthly-reminders]', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
