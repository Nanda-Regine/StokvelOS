// app/api/ai/constitution/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAiRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(user.id, 'constitution')
    if (!rl.success) return rateLimitResponse(rl)

    const { stokvelId } = await request.json()
    if (!stokvelId) return NextResponse.json({ error: 'stokvelId required' }, { status: 400 })

    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('*')
      .eq('id', stokvelId)
      .eq('admin_id', user.id)
      .single()

    if (!stokvel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: members } = await supabase
      .from('stokvel_members')
      .select('name, role')
      .eq('stokvel_id', stokvelId)
      .eq('status', 'active')

    const adminMember = members?.find(m => m.role === 'admin')
    const treasurer   = members?.find(m => m.role === 'treasurer')
    const secretary   = members?.find(m => m.role === 'secretary')
    const memberCount = members?.length || 0

    const userContent = `
Stokvel Name: ${stokvel.name}
Type: ${stokvel.type}
Province: ${stokvel.province || 'South Africa'}
Monthly Contribution: R${stokvel.monthly_amount} per member
Members: ${memberCount}
Payout Frequency: ${stokvel.payout_frequency}
Payout Order: ${stokvel.payout_order}
Start Date: ${stokvel.start_date || new Date().getFullYear()}
Chairperson/Admin: ${adminMember?.name || 'To be appointed'}
Treasurer: ${treasurer?.name || 'To be appointed'}
Secretary: ${secretary?.name || 'To be appointed'}
`.trim()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a South African legal document specialist. Write a formal, comprehensive stokvel constitution in plain English that complies with South African law (National Credit Act, Cooperative Banks Act awareness).

Structure the constitution with these numbered sections:
1. NAME AND ESTABLISHMENT
2. OBJECTIVES AND PURPOSE
3. MEMBERSHIP
   3.1 Eligibility
   3.2 Admission
   3.3 Rights and Responsibilities
   3.4 Termination of Membership
4. GOVERNANCE
   4.1 Office Bearers (Chairperson, Secretary, Treasurer)
   4.2 Meetings
   4.3 Quorum
5. FINANCIAL MANAGEMENT
   5.1 Contributions
   5.2 Banking
   5.3 Financial Year
   5.4 Auditing
6. CONTRIBUTIONS AND PAYMENTS
   6.1 Monthly Contributions
   6.2 Late Payments
   6.3 Penalties
7. PAYOUTS
   7.1 Payout Schedule
   7.2 Payout Order
   7.3 Disputes
8. MEETINGS
   8.1 Regular Meetings
   8.2 Special Meetings
   8.3 Voting
9. DISSOLUTION
10. AMENDMENTS TO CONSTITUTION
11. DISPUTE RESOLUTION
12. SIGNATURES

Use formal legal language but remain accessible. Include specific amounts and procedures based on the stokvel details provided. Add reasonable default rules for anything not specified (e.g., late penalty of 10% after 7 days).`,
      messages: [{ role: 'user', content: userContent }],
    })

    const constitution = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    await supabase
      .from('stokvels')
      .update({ constitution, updated_at: new Date().toISOString() })
      .eq('id', stokvelId)

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await writeAuditLog({
      stokvelId,
      actorId:   user.id,
      actorName: profile?.full_name || user.email || 'Admin',
      action:    AUDIT_ACTIONS.AI_CONSTITUTION,
    })

    return NextResponse.json({ constitution })
  } catch (err) {
    console.error('[AI Constitution]', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
