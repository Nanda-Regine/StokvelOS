// app/api/ai/meeting-minutes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { meetingId, stokvelName, meetingTitle, date, location, attendeeNames, rawNotes } = await request.json()

    if (!rawNotes?.trim()) {
      return NextResponse.json({ error: 'Raw notes are required' }, { status: 400 })
    }

    const attendeeList = attendeeNames?.length ? attendeeNames.join(', ') : 'Not recorded'

    const userContent = `
Stokvel: "${stokvelName}"
Meeting: "${meetingTitle}"
Date: ${date}
Location: ${location || 'Not specified'}
Attendees: ${attendeeList}

Raw notes from meeting:
${rawNotes}
    `.trim()

    const minutesResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are a professional secretary for a South African stokvel.
Convert rough meeting notes into formal, well-structured meeting minutes.

Format your response EXACTLY as follows (use these exact headings):

MEETING MINUTES
===============
[Stokvel name] — [Meeting title]
Date: [date]
Location: [location]
In Attendance: [names]

1. OPENING
[Brief opening paragraph]

2. MATTERS ARISING
[Key discussion points as numbered sub-items if multiple]

3. FINANCIAL REPORT
[Any financial matters, contributions, pot status mentioned]

4. ACTION ITEMS
[Numbered list of decisions made or tasks assigned]

5. NEXT MEETING
[Any mention of next meeting, or "To be confirmed"]

6. CLOSURE
[Brief closure statement]

---
Minutes recorded by StokvelOS AI
[Date]

Rules:
- Professional South African English
- If information is not in the notes, write "Not discussed" or make a reasonable professional inference
- Keep each section concise but complete
- Do not add fictional financial figures not mentioned in notes`,
      messages: [{ role: 'user', content: userContent }],
    })

    const minutes = minutesResponse.content[0].type === 'text' ? minutesResponse.content[0].text.trim() : ''

    const summaryResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      system: 'Write a 1-2 sentence summary of this stokvel meeting. Professional, plain language.',
      messages: [{ role: 'user', content: `${meetingTitle} — ${rawNotes}` }],
    })

    const summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text.trim() : ''

    if (meetingId) {
      await supabase
        .from('meetings')
        .update({
          formatted_minutes: minutes,
          ai_summary:        summary,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', meetingId)
    }

    return NextResponse.json({ minutes, summary })
  } catch (err) {
    console.error('[AI Meeting Minutes]', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
