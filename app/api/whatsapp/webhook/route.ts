// app/api/whatsapp/webhook/route.ts
// 360dialog inbound webhook — the primary member interface.
//
// Features:
//  1. Cached Stokvel Brain — stokvel context is prompt-cached (90% token cost reduction)
//  2. Stateful confirmations — pending transactions survive across messages
//  3. Dispute Resolution Agent — multi-turn mediation stored in Supabase
//  4. Constitution Compliance — auto-penalty detection, loan eligibility from extracted rules

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsAppText, normalisePhone } from '@/lib/whatsapp/360dialog'
import { runFraudDetection } from '@/lib/fraud/detector'
import {
  isDisputeMessage,
  getActiveDispute,
  openDispute,
  continueDispute,
} from '@/lib/agents/dispute'
import {
  loadRules,
  checkLatePayment,
  checkLoanEligibility,
  calculateLoanSchedule,
  applyLatePenalty,
  autoSuspendIfNeeded,
} from '@/lib/compliance/enforcer'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Webhook verification (GET) ────────────────────────────────
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  if (token === process.env.DIALOG360_WEBHOOK_SECRET) {
    return new NextResponse(request.nextUrl.searchParams.get('hub.challenge') || 'OK')
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── Inbound messages (POST) ───────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body    = await request.json()
    const messages = body.messages || body.entry?.[0]?.changes?.[0]?.value?.messages || []

    for (const msg of messages) {
      await handleMessage(msg).catch(err =>
        console.error('[Webhook] handleMessage failed:', err)
      )
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[Webhook] POST failed:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
async function handleMessage(msg: any) {
  const rawPhone  = msg.from || ''
  const phone     = normalisePhone(rawPhone)
  const messageId = msg.id || ''
  const text      = msg.text?.body || msg.caption || ''
  const msgType   = msg.type || 'text'

  if (!phone || !messageId) return

  // ── 1. Deduplication ────────────────────────────────────────
  const { data: existing } = await serviceClient
    .from('whatsapp_messages')
    .select('id')
    .eq('message_id', messageId)
    .single()
  if (existing) return

  // ── 2. Identify member + stokvel ────────────────────────────
  const { data: memberRows } = await serviceClient
    .from('stokvel_members')
    .select(`
      id, full_name, name, role, status, compliance_rate,
      monthly_amount, total_contributed, total_received, date_joined,
      stokvel_id,
      stokvels!inner(
        id, name, type, monthly_amount, contribution_due_day,
        payout_type, constitution_text, constitution,
        whatsapp_number, chairperson_phone,
        notion_contributions_db_id, extracted_rules
      )
    `)
    .eq('phone', phone)
    .eq('status', 'active')
    .limit(1)

  const memberRow = memberRows?.[0]
  const stokvel   = memberRow ? (memberRow as any).stokvels : null

  if (!memberRow || !stokvel) {
    await sendWhatsAppText(phone, 'Hi! I don\'t recognise your number. Ask your stokvel chairperson to add you, or visit stokvelos.co.za')
    return
  }

  const memberName = memberRow.full_name || memberRow.name || 'Member'
  const firstName  = memberName.split(' ')[0]

  // ── 3. Image messages (proof of payment) ───────────────────
  if (msgType === 'image') {
    await logMessage(messageId, phone, stokvel.id, memberRow.id, 'inbound', '[Image: proof of payment]', 'proof_of_payment', 0)
    await sendWhatsAppText(phone, `Thanks ${firstName}! Proof received. Your chairperson will verify it shortly. Reply "BALANCE" to check your current status.`)
    return
  }

  if (!text.trim()) return

  // ── 4. Check for YES/NO confirmation reply ──────────────────
  const isYes = /^(yes|confirm|yebo|ja|eya|haa|ok|sure)$/i.test(text.trim())
  const isNo  = /^(no|cancel|hayibo|nee|aowa|hapana)$/i.test(text.trim())

  if (isYes || isNo) {
    const handled = await handleConfirmationReply(phone, stokvel, memberRow, isYes, firstName)
    if (handled) return
  }

  // ── 5. Dispute routing ───────────────────────────────────────
  const activeDispute = await getActiveDispute(phone, stokvel.id)

  if (activeDispute) {
    // Continue an existing dispute conversation
    const reply = await continueDispute(activeDispute, text, phone, memberName)
    await sendWhatsAppText(phone, reply)
    await logMessage(messageId, phone, stokvel.id, memberRow.id, 'inbound', text, 'dispute', 0)
    await logMessage(`out_${messageId}`, phone, stokvel.id, memberRow.id, 'outbound', reply, 'dispute', 0)
    return
  }

  if (isDisputeMessage(text)) {
    // Open a new dispute
    const { firstReply } = await openDispute({
      stokvelId:   stokvel.id,
      complainantId: memberRow.id,
      phone,
      claimText:   text,
      stokvelName: stokvel.name,
      memberName,
    })
    await sendWhatsAppText(phone, firstReply)
    await logMessage(messageId, phone, stokvel.id, memberRow.id, 'inbound', text, 'dispute_open', 0)
    await logMessage(`out_${messageId}`, phone, stokvel.id, memberRow.id, 'outbound', firstReply, 'dispute_open', 0)
    return
  }

  // ── 6. Load constitution rules (no Claude call needed) ──────
  const rules = stokvel.extracted_rules
    ? stokvel.extracted_rules
    : await loadRules(stokvel.id)

  // ── 7. Build CACHED system prompt ──────────────────────────
  // The stokvel context is the large, static block — cached across all members
  // The member context is small and per-user — not cached
  const stokvelContextBlock = buildStokvelContextBlock(stokvel, rules)
  const memberContextBlock  = buildMemberContextBlock(memberRow)

  // ── 8. Call Claude with prompt caching ─────────────────────
  const response = await anthropic.beta.promptCaching.messages.create({
    model:     'claude-sonnet-4-6',
    max_tokens: 400,
    system: [
      {
        type:          'text' as const,
        text:          stokvelContextBlock,
        cache_control: { type: 'ephemeral' as const }, // ← CACHED: same for all 30 members
      },
      {
        type: 'text' as const,
        text: memberContextBlock,                       // ← not cached: changes per member
      },
    ],
    messages: [{ role: 'user', content: text }],
  })

  const aiText     = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens
  const fromCache  = (response.usage.cache_read_input_tokens ?? 0) > 0

  // ── 9. Parse Claude's response ──────────────────────────────
  let intent    = detectSimpleIntent(text)
  let replyText = aiText

  try {
    const jsonMatch = aiText.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      const action = JSON.parse(jsonMatch[1])
      intent    = action.intent || intent
      replyText = action.reply || aiText

      // ── 10. Route action ───────────────────────────────────
      switch (action.intent) {
        case 'record_payment':
          await handlePaymentIntent(action, memberRow, stokvel, phone, firstName, rules)
          break

        case 'loan_request':
          await handleLoanIntent(action, memberRow, stokvel, phone, firstName, rules)
          break

        case 'payout':
          if (!['chairperson', 'treasurer'].includes(memberRow.role)) {
            replyText = `Sorry ${firstName}, only the chairperson or treasurer can process payouts.`
          }
          break
      }
    }
  } catch { /* plain reply */ }

  // ── 11. Send reply + log ────────────────────────────────────
  await sendWhatsAppText(phone, replyText)
  await logMessage(messageId, phone, stokvel.id, memberRow.id, 'inbound',  text,      intent, tokensUsed, fromCache)
  await logMessage(`out_${messageId}`, phone, stokvel.id, memberRow.id, 'outbound', replyText, intent, 0)
}

// ── Stateful confirmation handler ────────────────────────────
async function handleConfirmationReply(
  phone:     string,
  stokvel:   any,
  member:    any,
  isYes:     boolean,
  firstName: string
): Promise<boolean> {
  const { data: pending } = await serviceClient
    .from('pending_confirmations')
    .select('*')
    .eq('phone',      phone)
    .eq('stokvel_id', stokvel.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!pending) return false

  // Expire the confirmation regardless
  await serviceClient.from('pending_confirmations').delete().eq('id', pending.id)

  if (!isYes) {
    await sendWhatsAppText(phone, `No problem ${firstName}! The transaction has been cancelled. Reply "HELP" to see what else I can do.`)
    return true
  }

  // Execute the confirmed action
  const payload = pending.payload as any

  if (pending.intent === 'record_payment') {
    const rules        = await loadRules(stokvel.id)
    const receiptNumber = `STK-${stokvel.id.slice(0, 6).toUpperCase()}-${Date.now()}`
    const today        = new Date().toISOString().split('T')[0]

    // Check for late payment penalty
    const lateCheck = checkLatePayment(
      today,
      stokvel.contribution_due_day || 1,
      payload.amount,
      rules
    )

    await serviceClient.from('contributions').insert({
      stokvel_id:     stokvel.id,
      member_id:      member.id,
      amount:         payload.amount,
      payment_date:   today,
      payment_method: payload.method || 'cash',
      receipt_number: receiptNumber,
      status:         'verified',
      notes:          lateCheck.isLate ? lateCheck.penaltyReason : null,
    })

    // Auto-apply late penalty if applicable
    if (lateCheck.isLate && lateCheck.penaltyAmount > 0) {
      await applyLatePenalty(stokvel.id, member.id, lateCheck.penaltyAmount, receiptNumber)
    }

    // Run fraud detection + suspension check async
    const { data: newContrib } = await serviceClient.from('contributions').select('*').eq('receipt_number', receiptNumber).single()
    if (newContrib) runFraudDetection(newContrib).catch(console.error)

    autoSuspendIfNeeded(member.id, stokvel.id, rules).catch(console.error)

    const penaltyMsg = lateCheck.isLate
      ? ` Note: R${lateCheck.penaltyAmount} late penalty applied (${lateCheck.daysLate} days late).`
      : ''

    await sendWhatsAppText(phone, `✅ R${payload.amount} recorded! Receipt: ${receiptNumber}.${penaltyMsg} Thank you ${firstName}!`)
  }

  return true
}

// ── Payment intent — store pending confirmation ───────────────
async function handlePaymentIntent(
  action:    any,
  member:    any,
  stokvel:   any,
  phone:     string,
  firstName: string,
  rules:     any
) {
  if (!action.requires_confirmation) return

  const today     = new Date().toISOString().split('T')[0]
  const lateCheck = checkLatePayment(today, stokvel.contribution_due_day || 1, action.amount, rules)
  const penaltyNote = lateCheck.isLate
    ? ` (Note: R${lateCheck.penaltyAmount} late fee will also be applied)`
    : ''

  const confirmText = `Confirm R${action.amount} payment via ${action.method || 'cash'}${penaltyNote}? Reply YES to confirm or NO to cancel.`

  // Store pending confirmation (expires in 10 minutes)
  await serviceClient.from('pending_confirmations').insert({
    stokvel_id:  stokvel.id,
    member_id:   member.id,
    phone,
    intent:      'record_payment',
    payload:     { amount: action.amount, method: action.method || 'cash' },
    prompt_text: confirmText,
    expires_at:  new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
}

// ── Loan intent — eligibility check using extracted rules ────
async function handleLoanIntent(
  action:    any,
  member:    any,
  stokvel:   any,
  phone:     string,
  firstName: string,
  rules:     any
) {
  const amount = action.amount || 0
  if (!amount) return

  const eligibility = await checkLoanEligibility(member.id, stokvel.id, amount, rules)

  if (!eligibility.eligible) {
    const reasonText = eligibility.reasons.join(' | ')
    await sendWhatsAppText(phone, `Sorry ${firstName}, you don't qualify for R${amount} right now: ${reasonText}. Max available: R${eligibility.maxAmount}.`)
    return
  }

  const schedule = calculateLoanSchedule(amount, rules)
  const summary  = `R${amount} loan approved in principle. Repay R${schedule.monthlyInstallment}/month for ${schedule.months} months (total R${schedule.totalRepayable}, ${rules.interest_rate_percent}% pm). Forwarding to chairperson for final approval.`

  // Notify chairperson
  const chairPhone = stokvel.chairperson_phone || stokvel.whatsapp_number
  if (chairPhone) {
    await sendWhatsAppText(chairPhone, `[Loan Request] ${member.full_name || member.name} is requesting R${amount}. Compliance: ${member.compliance_rate}%. Schedule: R${schedule.monthlyInstallment}/month × ${schedule.months} months. Reply "APPROVE LOAN ${member.id}" to approve.`)
  }

  await sendWhatsAppText(phone, `${summary} You'll hear back from your chairperson soon.`)
}

// ── Build the CACHED stokvel context block ────────────────────
function buildStokvelContextBlock(stokvel: any, rules: any): string {
  const rulesStr = rules ? `
EXTRACTED RULES (enforced automatically):
- Late grace period: ${rules.late_grace_days} days | Penalty: ${rules.late_penalty_type === 'percent' ? `${rules.late_penalty_percent}%` : `R${rules.late_penalty_fixed}`}
- Suspension: after ${rules.suspension_threshold_months} consecutive missed months
- Loans: ${rules.loans_allowed ? `allowed, max ${rules.max_loan_percent_of_funds}% of funds, ${rules.interest_rate_percent}% pm, min compliance ${rules.loan_eligibility_min_compliance}%` : 'not allowed'}
- Chairperson co-sign required above: R${rules.chairperson_co_sign_above}` : ''

  return `You are the StokvelOS AI assistant — the trusted, neutral record-keeper for ${stokvel.name}.

STOKVEL: ${stokvel.name}
TYPE: ${stokvel.type}
MONTHLY CONTRIBUTION: R${stokvel.monthly_amount}, due on the ${stokvel.contribution_due_day || 1}st
PAYOUT TYPE: ${stokvel.payout_type || 'rotating'}
CONSTITUTION SUMMARY: ${(stokvel.constitution || stokvel.constitution_text || 'Standard stokvel rules').slice(0, 500)}
${rulesStr}

CORE PRINCIPLES:
- Ubuntu first: the community comes before any individual.
- You are neutral. Never side with one member against another.
- Every transaction needs explicit member confirmation before recording.
- Warm but precise. Never cold. This is their money and their community.

LANGUAGE: Detect the member's language (isiZulu, isiXhosa, Sesotho, Setswana, Afrikaans, English) and respond in kind. Code-switch naturally.

WHATSAPP FORMAT: Under 300 characters. Emoji: ✅ 💰 ❌ 📊 only. Always end with next action.

FOR PAYMENT: Return JSON:
\`\`\`json
{"intent":"record_payment","reply":"<message>","amount":<number>,"method":"<cash|eft|payfast>","requires_confirmation":true}
\`\`\`

FOR LOAN: Return JSON:
\`\`\`json
{"intent":"loan_request","reply":"<message>","amount":<number>}
\`\`\`

FOR BALANCE/REPORT: Respond conversationally with member's stats.`
}

// ── Build the per-member context (NOT cached) ─────────────────
function buildMemberContextBlock(member: any): string {
  return `CURRENT MEMBER: ${member.full_name || member.name}
ROLE: ${member.role}
COMPLIANCE: ${member.compliance_rate}%
TOTAL CONTRIBUTED: R${member.total_contributed || 0}
TOTAL RECEIVED: R${member.total_received || 0}`
}

// ── Simple intent detection (no Claude) ──────────────────────
function detectSimpleIntent(text: string): string {
  const t = text.toLowerCase().trim()
  if (/^(balance|bakho|balanse|ibalance)$/i.test(t))   return 'balance_check'
  if (/paid|ngikhokhile|betaal/i.test(t))               return 'record_payment'
  if (/loan|boleko|mboleko|lening/i.test(t))            return 'loan_request'
  if (/payout|khokhelwa|uitbetaal/i.test(t))            return 'payout_query'
  if (/report|umbiko|verslag/i.test(t))                 return 'report_request'
  if (/dispute|complaint|wrong/i.test(t))               return 'dispute'
  if (/help|usizo|hulp/i.test(t))                       return 'help'
  return 'general'
}

// ── Message logger ────────────────────────────────────────────
async function logMessage(
  messageId: string,
  phone: string,
  stokvelId: string,
  memberId: string,
  direction: 'inbound' | 'outbound',
  content: string,
  intent: string,
  tokensUsed: number,
  fromCache = false
) {
  await serviceClient.from('whatsapp_messages').insert({
    message_id:  messageId,
    stokvel_id:  stokvelId,
    member_id:   memberId,
    phone,
    direction,
    content,
    intent,
    tokens_used: tokensUsed,
    from_cache:  fromCache,
  })
}
