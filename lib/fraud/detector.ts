// lib/fraud/detector.ts
// Runs after every contribution is recorded.
// Checks for common fraud patterns and stores alerts.
// All balance calculations are derived from source records — never trusts stokvels.total_funds.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/whatsapp/360dialog'

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Contribution {
  id:         string
  stokvel_id: string
  member_id:  string
  amount:     number
  date:       string          // existing column name (not payment_date)
  method?:    string
  receipt_number?: string
}

export interface FraudAlert {
  type:        string
  severity:    'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence?:   object
}

export async function runFraudDetection(contribution: Contribution): Promise<FraudAlert[]> {
  const supabase = getSupabase()
  const alerts: FraudAlert[] = []
  const { stokvel_id, member_id, amount, date } = contribution

  // ── 1. Duplicate payment (same member, same amount, same day) ─
  const { data: duplicates } = await supabase
    .from('contributions')
    .select('id, receipt_number')
    .eq('stokvel_id', stokvel_id)
    .eq('member_id', member_id)
    .eq('amount', amount)
    .eq('date', date)
    .neq('id', contribution.id)

  if (duplicates && duplicates.length > 0) {
    alerts.push({
      type:        'duplicate_payment',
      severity:    'high',
      description: `Duplicate payment: same member, R${amount}, same date (${date})`,
      evidence:    { existingReceipts: duplicates.map(d => d.receipt_number).filter(Boolean) },
    })
  }

  // ── 2. Unusual amount (>3× expected monthly contribution) ─────
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('monthly_amount, chairperson_phone, whatsapp_number')
    .eq('id', stokvel_id)
    .single()

  const { data: memberRow } = await supabase
    .from('stokvel_members')
    .select('name, monthly_amount, role')
    .eq('id', member_id)
    .single()

  const expectedAmount = Number(memberRow?.monthly_amount ?? stokvel?.monthly_amount ?? 0)
  if (expectedAmount > 0 && amount > expectedAmount * 3) {
    alerts.push({
      type:        'unusual_amount',
      severity:    'medium',
      description: `Unusual amount: R${amount} is ${(amount / expectedAmount).toFixed(1)}× the expected R${expectedAmount} (member: ${memberRow?.name ?? 'unknown'})`,
      evidence:    { amount, expectedAmount, multiplier: +(amount / expectedAmount).toFixed(1) },
    })
  }

  // ── 3. Balance discrepancy — calculate from source records ────
  // Never trust stokvels.total_funds — always derive from contributions and payouts
  const [{ data: allContribs }, { data: allPayouts }] = await Promise.all([
    supabase
      .from('contributions')
      .select('amount')
      .eq('stokvel_id', stokvel_id)
      .in('status', ['confirmed', 'verified']),
    supabase
      .from('payouts')
      .select('amount')
      .eq('stokvel_id', stokvel_id)
      .in('status', ['paid', 'scheduled']),
  ])

  const totalIn          = (allContribs  || []).reduce((s, c) => s + Number(c.amount), 0)
  const totalOut         = (allPayouts   || []).reduce((s, p) => s + Number(p.amount), 0)
  const derivedBalance   = totalIn - totalOut
  const recordedBalance  = Number(stokvel ? (await supabase.from('stokvels').select('total_funds').eq('id', stokvel_id).single()).data?.total_funds ?? 0 : 0)

  // Only flag if there IS a recorded balance AND it's materially different (>R10 AND >1%)
  if (recordedBalance > 0) {
    const diff    = Math.abs(derivedBalance - recordedBalance)
    const pctDiff = diff / recordedBalance
    if (diff > 10 && pctDiff > 0.01) {
      alerts.push({
        type:        'balance_discrepancy',
        severity:    'critical',
        description: `Balance discrepancy: derived R${derivedBalance.toFixed(2)} vs recorded R${recordedBalance.toFixed(2)} (difference: R${diff.toFixed(2)})`,
        evidence:    { derivedBalance, recordedBalance, difference: derivedBalance - recordedBalance, percentDiff: +(pctDiff * 100).toFixed(1) },
      })
    }
  }

  // ── 4. Rapid payments (same member, ≥3 contributions in 60 min) ─
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('contributions')
    .select('id', { count: 'exact', head: true })
    .eq('stokvel_id', stokvel_id)
    .eq('member_id', member_id)
    .gte('created_at', oneHourAgo)
    .neq('id', contribution.id)

  if ((recentCount ?? 0) >= 2) {
    alerts.push({
      type:        'rapid_payments',
      severity:    'high',
      description: `Rapid payments: ${(recentCount ?? 0) + 1} contributions from ${memberRow?.name ?? 'member'} in 60 minutes`,
      evidence:    { count: (recentCount ?? 0) + 1 },
    })
  }

  // ── Store alerts ──────────────────────────────────────────────
  if (alerts.length > 0) {
    await Promise.all(
      alerts.map(alert =>
        supabase.from('fraud_alerts').insert({
          stokvel_id:  stokvel_id,
          member_id:   member_id,
          alert_type:  alert.type,
          severity:    alert.severity,
          description: alert.description,
          evidence:    alert.evidence ?? {},
          status:      'open',
        })
      )
    )

    // Notify the chairperson via their personal WhatsApp number
    // Use chairperson_phone (personal) NOT whatsapp_number (the bot's line)
    const notifyPhone = stokvel?.chairperson_phone
    if (notifyPhone) {
      await notifyChairperson(notifyPhone, stokvel_id, alerts).catch(err =>
        console.error('[Fraud] chairperson notify failed:', err)
      )
    }
  }

  return alerts
}

async function notifyChairperson(
  chairpersonPhone: string,
  stokvelId: string,
  alerts: FraudAlert[]
): Promise<void> {
  const supabase = getSupabase()
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('name')
    .eq('id', stokvelId)
    .single()

  const urgency    = alerts.some(a => a.severity === 'critical') ? 'CRITICAL'
    : alerts.some(a => a.severity === 'high') ? 'HIGH' : 'MEDIUM'

  const summary    = alerts.map(a => `• ${a.description}`).join('\n')
  const message    = `[${urgency}] StokvelOS Fraud Alert — ${stokvel?.name ?? ''}\n\n${alerts.length} alert(s) detected:\n${summary}\n\nReview: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

  await sendWhatsAppText(chairpersonPhone, message)
}
