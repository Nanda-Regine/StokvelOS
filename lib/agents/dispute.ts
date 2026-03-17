// lib/agents/dispute.ts
// Stateful dispute resolution agent.
// State lives in Supabase — the agent can mediate across hours or days of WhatsApp messages.
// Claude is called per turn but with a tight summarised context, keeping costs low.

import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/whatsapp/360dialog'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// States
export type DisputeState =
  | 'open'
  | 'investigating'
  | 'awaiting_complainant_proof'
  | 'awaiting_respondent_proof'
  | 'reviewing'
  | 'resolved'
  | 'escalated'

// ── Detect if a message is a dispute claim ─────────────────────
export function isDisputeMessage(text: string): boolean {
  return /dispute|complaint|wrong|unfair|I didn.t|never paid|I already paid|fake|lied|steal|missing|not recorded|I was charged|incorrect/i.test(text)
}

// ── Check if phone has an active dispute ──────────────────────
export async function getActiveDispute(phone: string, stokvelId: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('disputes')
    .select('*')
    .eq('stokvel_id', stokvelId)
    .not('state', 'in', '("resolved","escalated")')
    .or(`awaiting_phone.eq.${phone}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data
}

// ── Open a new dispute ─────────────────────────────────────────
export async function openDispute(params: {
  stokvelId:     string
  complainantId: string
  phone:         string
  claimText:     string
  stokvelName:   string
  memberName:    string
}): Promise<{ dispute: any; firstReply: string }> {
  const supabase  = getSupabase()
  const { stokvelId, complainantId, phone, claimText, stokvelName, memberName } = params

  // Run initial automated investigation
  const investigation = await investigateClaim(stokvelId, complainantId, claimText)

  // Create dispute record
  const conversation = [
    { role: 'complainant', content: claimText,            ts: new Date().toISOString() },
    { role: 'agent',       content: investigation.summary, ts: new Date().toISOString() },
  ]

  const { data: dispute } = await supabase
    .from('disputes')
    .insert({
      stokvel_id:    stokvelId,
      complainant_id: complainantId,
      subject:       extractSubject(claimText),
      state:         investigation.canResolve ? 'reviewing' : 'investigating',
      awaiting_phone: investigation.canResolve ? null : phone,
      evidence:      investigation.evidence,
      conversation,
    })
    .select()
    .single()

  let firstReply: string

  if (investigation.canResolve && investigation.resolution) {
    // Auto-resolved based on records alone
    await supabase
      .from('disputes')
      .update({ state: 'resolved', resolution: investigation.resolution, resolved_at: new Date().toISOString() })
      .eq('id', dispute.id)

    firstReply = `Hi ${memberName.split(' ')[0]}! I've looked into your concern.\n\n${investigation.resolution}\n\nIs there anything else I can help you with?`
  } else {
    firstReply = `Hi ${memberName.split(' ')[0]}, I've opened a dispute case for ${stokvelName}.\n\n${investigation.summary}\n\nTo help resolve this, could you please send proof? (bank statement screenshot, receipt photo, or reference number)`
  }

  return { dispute, firstReply }
}

// ── Continue an existing dispute conversation ──────────────────
export async function continueDispute(
  dispute:  any,
  newMessage: string,
  phone:    string,
  memberName: string
): Promise<string> {
  const supabase = getSupabase()

  // Append new message to conversation
  const conversation = [...(dispute.conversation || []),
    { role: 'member', content: newMessage, ts: new Date().toISOString() }
  ]

  // Summarise if conversation is getting long (>8 turns) to save tokens
  const contextForClaude = conversation.length > 8
    ? await summariseConversation(conversation)
    : formatConversationForClaude(conversation)

  // Call Claude with tight context
  const response = await anthropic.beta.promptCaching.messages.create({
    model:     'claude-sonnet-4-6',
    max_tokens: 300,
    system: [
      {
        type:          'text' as const,
        text:          DISPUTE_AGENT_INSTRUCTIONS,
        cache_control: { type: 'ephemeral' as const }, // cached — same for all disputes
      },
      {
        type: 'text' as const,
        text: `DISPUTE CONTEXT:\nSubject: ${dispute.subject}\nCurrent state: ${dispute.state}\nEvidence gathered: ${JSON.stringify(dispute.evidence)}\n\nCONVERSATION SO FAR:\n${contextForClaude}`,
      },
    ],
    messages: [{ role: 'user', content: `New message from member: "${newMessage}"` }],
  })

  const aiText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  // Parse for state transitions
  let newState = dispute.state
  let resolution: string | null = null
  let replyText = aiText

  try {
    const jsonMatch = aiText.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      const action = JSON.parse(jsonMatch[1])
      replyText  = action.reply || aiText
      newState   = action.newState || newState
      resolution = action.resolution || null

      // If escalating, notify chairperson
      if (newState === 'escalated') {
        await notifyChairpersonOfDispute(dispute.stokvel_id, dispute, resolution || 'Agent could not resolve')
      }
    }
  } catch { /* plain reply */ }

  // Update dispute state
  const updatedConversation = [...conversation,
    { role: 'agent', content: replyText, ts: new Date().toISOString() }
  ]

  await supabase.from('disputes').update({
    state:        newState,
    conversation: updatedConversation,
    ...(resolution ? { resolution, resolved_at: new Date().toISOString() } : {}),
    ...(newState === 'escalated' ? { escalated_at: new Date().toISOString() } : {}),
    awaiting_phone: ['awaiting_complainant_proof', 'awaiting_respondent_proof', 'investigating'].includes(newState)
      ? phone : null,
  }).eq('id', dispute.id)

  return replyText
}

// ── Internal: investigate a claim against records ─────────────
async function investigateClaim(
  stokvelId: string,
  memberId:  string,
  claimText: string
): Promise<{
  summary:    string
  canResolve: boolean
  resolution: string | null
  evidence:   object
}> {
  const supabase = getSupabase()

  // Pull last 6 months of contributions for this member
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: contributions } = await supabase
    .from('contributions')
    .select('amount, payment_date, status, receipt_number, payment_method')
    .eq('member_id',  memberId)
    .eq('stokvel_id', stokvelId)
    .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0])
    .order('payment_date', { ascending: false })

  const { data: loans } = await supabase
    .from('loans')
    .select('amount, balance_outstanding, status, start_date')
    .eq('member_id',  memberId)
    .eq('stokvel_id', stokvelId)

  const evidence = { contributions: contributions || [], loans: loans || [] }

  // Ask Claude to interpret claim vs evidence
  const response = await anthropic.messages.create({
    model:     'claude-sonnet-4-6',
    max_tokens: 200,
    system:    'You are investigating a stokvel dispute. Given the member\'s claim and their financial records, determine if the claim can be resolved from records alone, or needs more proof. Be fair and neutral. Respond in JSON: {"canResolve":boolean,"summary":"brief finding","resolution":"if canResolve, what the records show"}',
    messages:  [{
      role:    'user',
      content: `Claim: "${claimText}"\n\nRecords:\n${JSON.stringify(evidence, null, 2).slice(0, 1500)}`,
    }],
  })

  try {
    const raw  = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return { ...result, evidence }
  } catch {
    return {
      summary:    'I\'ve found your records and will investigate your concern.',
      canResolve: false,
      resolution: null,
      evidence,
    }
  }
}

async function summariseConversation(conversation: any[]): Promise<string> {
  const full = formatConversationForClaude(conversation)
  const response = await anthropic.messages.create({
    model:     'claude-sonnet-4-6',
    max_tokens: 150,
    system:    'Summarise this dispute conversation in 3 sentences, keeping all key facts and claims.',
    messages:  [{ role: 'user', content: full }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : full
}

function formatConversationForClaude(conversation: any[]): string {
  return conversation.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
}

function extractSubject(claimText: string): string {
  if (/payment|paid|contribution/i.test(claimText)) return 'Contribution dispute'
  if (/loan|borrow/i.test(claimText))               return 'Loan dispute'
  if (/payout|receive|pot/i.test(claimText))         return 'Payout dispute'
  if (/penalty|fine|charge/i.test(claimText))        return 'Penalty dispute'
  return 'General dispute'
}

async function notifyChairpersonOfDispute(
  stokvelId: string,
  dispute:   any,
  summary:   string
): Promise<void> {
  const supabase = getSupabase()
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('name, chairperson_phone')
    .eq('id', stokvelId)
    .single()

  if (!stokvel?.chairperson_phone) return

  const message = `[StokvelOS] Dispute Escalated — ${stokvel.name}\n\nSubject: ${dispute.subject}\n\n${summary}\n\nThe AI could not resolve this dispute. Please intervene.\n\nView details: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
  await sendWhatsAppText(stokvel.chairperson_phone, message)
}

const DISPUTE_AGENT_INSTRUCTIONS = `You are a neutral, trusted dispute mediator for a South African stokvel community.

YOUR ROLE:
- You are not on anyone's side. You protect the community's trust and harmony.
- You investigate claims by comparing them against financial records.
- You ask for evidence clearly and only once.
- You resolve what the records can settle. You escalate what they cannot.

TONE:
- Warm, respectful, ubuntu-centred. These are community members, not adversaries.
- Never accusatory. Never dismiss a concern.
- Keep messages under 300 characters for WhatsApp.

STATE TRANSITIONS — respond with JSON when transitioning:
\`\`\`json
{"reply":"<WhatsApp message>","newState":"<state>","resolution":"<if resolved>"}
\`\`\`

States: investigating → awaiting_complainant_proof → reviewing → resolved | escalated

RESOLVE when: records clearly confirm or deny the claim.
ESCALATE when: after 2 rounds of evidence, claim is still unclear — the chairperson must decide.
Never keep a dispute open more than 5 turns without resolving or escalating.`
