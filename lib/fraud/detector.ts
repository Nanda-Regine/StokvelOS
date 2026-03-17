// lib/fraud/detector.ts
// Runs after every contribution is recorded.
// Checks for common fraud patterns and stores alerts.

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
  payment_date: string
  payment_method: string
  receipt_number: string
}

interface FraudAlert {
  type:        string
  severity:    'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence?:   object
}

export async function runFraudDetection(
  contribution: Contribution
): Promise<FraudAlert[]> {
  const supabase   = getSupabase()
  const alerts: FraudAlert[] = []
  const { stokvel_id, member_id, amount, payment_date } = contribution

  // ── 1. Duplicate payment check (same member, same amount, same day) ──
  const { data: duplicates } = await supabase
    .from('contributions')
    .select('id, receipt_number')
    .eq('stokvel_id', stokvel_id)
    .eq('member_id',  member_id)
    .eq('amount',     amount)
    .eq('payment_date', payment_date)
    .neq('id', contribution.id)

  if (duplicates && duplicates.length > 0) {
    alerts.push({
      type:     'duplicate_payment',
      severity: 'high',
      description: `Duplicate payment detected: same member, same amount (R${amount}), same date (${payment_date})`,
      evidence:    { existingReceipts: duplicates.map(d => d.receipt_number) },
    })
  }

  // ── 2. Unusual amount check (>3x normal contribution) ───────────────
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('monthly_amount, whatsapp_number')
    .eq('id', stokvel_id)
    .single()

  const { data: memberRow } = await supabase
    .from('stokvel_members')
    .select('name, monthly_amount, role')
    .eq('id', member_id)
    .single()

  const expectedAmount = memberRow?.monthly_amount || stokvel?.monthly_amount || 0
  if (expectedAmount > 0 && amount > expectedAmount * 3) {
    alerts.push({
      type:     'unusual_amount',
      severity: 'medium',
      description: `Unusual amount: R${amount} is more than 3x the expected R${expectedAmount} for member ${memberRow?.name}`,
      evidence:    { amount, expectedAmount, multiplier: +(amount / expectedAmount).toFixed(1) },
    })
  }

  // ── 3. Balance discrepancy check ────────────────────────────────────
  const { data: allContribs } = await supabase
    .from('contributions')
    .select('amount')
    .eq('stokvel_id', stokvel_id)
    .eq('status', 'verified')

  const { data: allPayouts } = await supabase
    .from('payouts')
    .select('amount')
    .eq('stokvel_id', stokvel_id)

  const totalIn  = (allContribs || []).reduce((s, c) => s + Number(c.amount), 0)
  const totalOut = (allPayouts  || []).reduce((s, p) => s + Number(p.amount), 0)
  const calculatedBalance = totalIn - totalOut

  const { data: stokvelBalance } = await supabase
    .from('stokvels')
    .select('total_funds')
    .eq('id', stokvel_id)
    .single()

  const recordedBalance = Number(stokvelBalance?.total_funds || 0)
  if (recordedBalance > 0 && Math.abs(calculatedBalance - recordedBalance) > 10) {
    alerts.push({
      type:     'balance_discrepancy',
      severity: 'critical',
      description: `Balance discrepancy: calculated R${calculatedBalance.toFixed(2)} vs recorded R${recordedBalance.toFixed(2)} (difference: R${Math.abs(calculatedBalance - recordedBalance).toFixed(2)})`,
      evidence:    { calculatedBalance, recordedBalance, difference: calculatedBalance - recordedBalance },
    })
  }

  // ── 4. Rapid-fire contributions (same member, >2 payments in 60 mins) ─
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentPayments } = await supabase
    .from('contributions')
    .select('id')
    .eq('stokvel_id', stokvel_id)
    .eq('member_id',  member_id)
    .gte('created_at', oneHourAgo)
    .neq('id', contribution.id)

  if (recentPayments && recentPayments.length >= 2) {
    alerts.push({
      type:     'rapid_payments',
      severity: 'high',
      description: `Rapid payments: ${recentPayments.length + 1} contributions from member ${memberRow?.name} in the last 60 minutes`,
      evidence:    { count: recentPayments.length + 1 },
    })
  }

  // ── Store alerts and notify chairperson ─────────────────────────────
  for (const alert of alerts) {
    await supabase.from('fraud_alerts').insert({
      stokvel_id:  stokvel_id,
      member_id:   member_id,
      alert_type:  alert.type,
      severity:    alert.severity,
      description: alert.description,
      evidence:    alert.evidence || {},
      status:      'open',
    })
  }

  if (alerts.length > 0 && stokvel?.whatsapp_number) {
    await notifyChairpersonViaWhatsApp(stokvel_id, stokvel.whatsapp_number, alerts)
  }

  return alerts
}

async function notifyChairpersonViaWhatsApp(
  stokvelId: string,
  chairpersonPhone: string,
  alerts: FraudAlert[]
): Promise<void> {
  try {
    const supabase = getSupabase()
    const { data: stokvel } = await supabase
      .from('stokvels')
      .select('name, chairperson_phone')
      .eq('id', stokvelId)
      .single()

    const targetPhone = stokvel?.chairperson_phone || chairpersonPhone
    if (!targetPhone) return

    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const highCount     = alerts.filter(a => a.severity === 'high').length

    const urgency = criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'HIGH' : 'MEDIUM'
    const summary = alerts.map(a => `- ${a.description}`).join('\n')

    const message = `[${urgency}] StokvelOS Fraud Alert\n\n${alerts.length} alert(s) detected:\n${summary}\n\nPlease log in to review: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

    await sendWhatsAppText(targetPhone, message)
  } catch (err) {
    console.error('[Fraud] notifyChairperson failed:', err)
  }
}
