import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { buildWhatsAppUrl } from '@/lib/utils'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stokvelId, memberIds } = await request.json()
    if (!stokvelId || !Array.isArray(memberIds)) {
      return NextResponse.json({ error: 'stokvelId and memberIds required' }, { status: 400 })
    }

    // Verify ownership
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('name, monthly_amount')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: members } = await supabase
      .from('stokvel_members')
      .select('id, name, phone, monthly_amount')
      .eq('stokvel_id', stokvelId)
      .in('id', memberIds)

    if (!members?.length) return NextResponse.json({ reminders: [] })

    const reminders = await Promise.all(
      members.map(async (member) => {
        const amount = member.monthly_amount ?? stokvel.monthly_amount

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Write a short, friendly WhatsApp reminder (max 2 sentences, South African tone) for ${member.name} to pay their R${amount} stokvel contribution to ${stokvel.name}. Be warm and respectful.`,
          }],
          max_tokens: 100,
          temperature: 0.7,
        })

        const message = completion.choices[0].message.content?.trim() ?? `Hi ${member.name}, please remember to pay your R${amount} contribution to ${stokvel.name}.`
        const whatsappUrl = member.phone ? buildWhatsAppUrl(member.phone, message) : null

        return {
          memberId: member.id,
          memberName: member.name,
          amount,
          message,
          whatsappUrl,
        }
      })
    )

    return NextResponse.json({ reminders })
  } catch (err) {
    console.error('[AI reminders]', err)
    return NextResponse.json({ error: 'Failed to generate reminders' }, { status: 500 })
  }
}
