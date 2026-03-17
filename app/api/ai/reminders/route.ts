// app/api/ai/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { buildWhatsAppUrl } from '@/lib/utils'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(user.id, 'reminders')
    if (!rl.success) return rateLimitResponse(rl)

    const { stokvelId, members } = await request.json()
    if (!stokvelId || !members?.length) return NextResponse.json({ error: 'stokvelId and members required' }, { status: 400 })
    if (members.length > 100) return NextResponse.json({ error: 'Max 100 members per request' }, { status: 400 })

    const { data: stokvel } = await supabase.from('stokvels').select('name, monthly_amount').eq('id', stokvelId).single()

    const prompt = members.map((m: { name: string; amount: number }) =>
      `- ${m.name} owes R${m.amount}`
    ).join('\n')

    let reminders: Array<{ memberName: string; message: string }> = []
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: `You are writing WhatsApp reminder messages for a South African stokvel called "${stokvel?.name}".
For each member listed, write ONE friendly reminder under 3 sentences. Use Ubuntu spirit — warm, communal, never shaming.
Include their name and amount. Use simple language. South African English.
Respond ONLY with valid JSON array: [{"memberId": null, "memberName": "Name", "message": "..."}]
Use the exact member names provided. No preamble, no markdown, just the JSON array.`,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
      reminders = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      reminders = members.map((m: { name: string; amount: number }) => ({
        memberName: m.name,
        message: `Hi ${m.name.split(' ')[0]}! Your ${stokvel?.name} contribution of R${m.amount} is due. Our stokvel is stronger when we all contribute together. Please pay at your earliest convenience.`,
      }))
    }

    const result = members.map((m: { id: string; name: string; phone?: string; amount: number }, i: number) => ({
      memberId:    m.id,
      memberName:  m.name,
      amount:      m.amount,
      message:     reminders[i]?.message || `Hi ${m.name.split(' ')[0]}, your contribution of R${m.amount} is due.`,
      whatsappUrl: m.phone ? buildWhatsAppUrl(m.phone, reminders[i]?.message || '') : null,
    }))

    return NextResponse.json({ reminders: result })
  } catch (err) {
    console.error('[AI Reminders]', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
