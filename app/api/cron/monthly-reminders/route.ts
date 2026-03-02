// app/api/cron/monthly-reminders/route.ts
// Called by Vercel Cron on the 1st of each month at 08:00 SAST
// Generates personalised AI reminder messages and logs which stokvels were reminded

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildWhatsAppUrl } from '@/lib/utils'
import OpenAI from 'openai'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function GET(request: NextRequest) {
  // Verify this is a Vercel cron call
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now      = new Date()
  const month    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStr = `${month}-01`

  try {
    // Get all active stokvels
    const { data: stokvels } = await serviceClient.from('stokvels').select('id, name, monthly_amount')

    let totalReminders = 0
    const results: { stokvelId: string; reminded: number }[] = []

    for (const stokvel of stokvels || []) {
      // Check if already sent reminders this month
      const { data: existing } = await serviceClient
        .from('reminder_log').select('id').eq('stokvel_id', stokvel.id).eq('month', month).single()
      if (existing) continue // Already sent this month

      // Get active members
      const { data: members } = await serviceClient
        .from('stokvel_members').select('id, name, phone, monthly_amount')
        .eq('stokvel_id', stokvel.id).eq('status', 'active')

      // Find who hasn't paid yet this month
      const { data: paid } = await serviceClient
        .from('contributions').select('member_id').eq('stokvel_id', stokvel.id)
        .eq('status', 'confirmed').gte('date', monthStr)

      const paidIds    = new Set((paid || []).map(p => p.member_id))
      const outstanding = (members || []).filter(m => !paidIds.has(m.id) && m.phone)

      if (outstanding.length === 0) continue

      // Generate AI reminders
      let reminders: Array<{ memberName: string; message: string }> = []
      try {
        const prompt = outstanding.map(m => `- ${m.name} owes R${m.monthly_amount || stokvel.monthly_amount}`).join('\n')
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 400,
          messages: [
            {
              role: 'system',
              content: `Write brief WhatsApp reminders for ${stokvel.name} stokvel members. Friendly, Ubuntu spirit, under 2 sentences each. JSON array: [{"memberName":"Name","message":"..."}]. No markdown.`,
            },
            { role: 'user', content: prompt },
          ],
        })
        const text = completion.choices[0]?.message?.content?.trim() || '[]'
        reminders = JSON.parse(text.replace(/```json|```/g, '').trim())
      } catch {
        // Fallback template
        reminders = outstanding.map(m => ({
          memberName: m.name,
          message:    `Hi ${m.name.split(' ')[0]}! 👋 Your ${stokvel.name} contribution of R${m.monthly_amount || stokvel.monthly_amount} is due this month. Please pay when you can. 🙏`,
        }))
      }

      // Log WhatsApp URLs (for dashboard display — actual sending is via WhatsApp link)
      const reminderLinks = outstanding.map((m, i) => ({
        memberId:    m.id,
        memberName:  m.name,
        phone:       m.phone,
        message:     reminders[i]?.message || '',
        whatsappUrl: buildWhatsAppUrl(m.phone!, reminders[i]?.message || ''),
      }))

      // Store reminder log
      await serviceClient.from('reminder_log').insert({
        stokvel_id: stokvel.id,
        month,
        sent_count: outstanding.length,
      })

      totalReminders += outstanding.length
      results.push({ stokvelId: stokvel.id, reminded: outstanding.length })
    }

    return NextResponse.json({
      success:        true,
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
