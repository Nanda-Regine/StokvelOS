// lib/compliance/enforcer.ts
// Pure rule enforcement — NO Claude calls.
// Rules are extracted once from the constitution and stored in Supabase.
// This runs on every transaction, contribution, and loan request.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ExtractedRules } from './extractor'
import { getDefaultRules } from './extractor'

function getSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Load rules for a stokvel (from DB or defaults) ─────────────
export async function loadRules(stokvelId: string): Promise<ExtractedRules> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('stokvels')
    .select('extracted_rules')
    .eq('id', stokvelId)
    .single()

  return (data?.extracted_rules as ExtractedRules) ?? getDefaultRules()
}

// ── Check if a payment is late and calculate penalty ──────────
export interface LatePaymentResult {
  isLate:        boolean
  daysLate:      number
  penaltyAmount: number
  penaltyReason: string
}

export function checkLatePayment(
  paymentDate: string,   // YYYY-MM-DD
  dueDayOfMonth: number, // e.g. 1 = 1st of month
  contributionAmount: number,
  rules: ExtractedRules
): LatePaymentResult {
  const paid     = new Date(paymentDate)
  const dueDate  = new Date(paid.getFullYear(), paid.getMonth(), dueDayOfMonth)
  const graceEnd = new Date(dueDate)
  graceEnd.setDate(dueDate.getDate() + rules.late_grace_days)

  const daysLate = Math.max(0, Math.floor((paid.getTime() - graceEnd.getTime()) / 86400000))
  const isLate   = daysLate > 0

  let penaltyAmount = 0
  if (isLate) {
    if (rules.late_penalty_type === 'percent') {
      penaltyAmount = (contributionAmount * rules.late_penalty_percent) / 100
    } else if (rules.late_penalty_fixed) {
      penaltyAmount = rules.late_penalty_fixed
    }
  }

  return {
    isLate,
    daysLate,
    penaltyAmount: Math.round(penaltyAmount * 100) / 100,
    penaltyReason: isLate
      ? `Payment ${daysLate} day(s) late (grace period: ${rules.late_grace_days} days). Penalty: R${penaltyAmount.toFixed(2)}`
      : '',
  }
}

// ── Check if a member should be suspended ─────────────────────
export interface SuspensionCheckResult {
  shouldSuspend:       boolean
  consecutiveMisses:   number
  threshold:           number
  reason:              string
}

export async function checkSuspensionThreshold(
  memberId:  string,
  stokvelId: string,
  rules:     ExtractedRules
): Promise<SuspensionCheckResult> {
  const supabase = getSupabase()

  // Get last N months and check which ones were missed
  const monthsToCheck = rules.suspension_threshold_months + 1
  const months: string[] = []
  const now = new Date()

  for (let i = 1; i <= monthsToCheck; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Check contributions for each month
  let consecutiveMisses = 0
  for (const month of months) {
    const monthStart = `${month}-01`
    const nextMonth  = new Date(monthStart)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthEnd = nextMonth.toISOString().split('T')[0]

    const { count } = await supabase
      .from('contributions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id',  memberId)
      .eq('stokvel_id', stokvelId)
      .in('status', ['verified', 'confirmed'])
      .gte('payment_date', monthStart)
      .lt('payment_date', monthEnd)

    if ((count ?? 0) === 0) {
      consecutiveMisses++
    } else {
      break // streak broken — stop counting
    }
  }

  const shouldSuspend = consecutiveMisses >= rules.suspension_threshold_months

  return {
    shouldSuspend,
    consecutiveMisses,
    threshold:  rules.suspension_threshold_months,
    reason:     shouldSuspend
      ? `Member has missed ${consecutiveMisses} consecutive months (threshold: ${rules.suspension_threshold_months})`
      : '',
  }
}

// ── Check loan eligibility ─────────────────────────────────────
export interface LoanEligibilityResult {
  eligible:  boolean
  reasons:   string[]
  maxAmount: number
}

export async function checkLoanEligibility(
  memberId:    string,
  stokvelId:   string,
  requestedAmount: number,
  rules:       ExtractedRules
): Promise<LoanEligibilityResult> {
  const supabase = getSupabase()
  const reasons: string[] = []

  if (!rules.loans_allowed) {
    return { eligible: false, reasons: ['This stokvel does not allow loans'], maxAmount: 0 }
  }

  // 1. Compliance rate check
  const { data: member } = await supabase
    .from('stokvel_members')
    .select('compliance_rate, date_joined')
    .eq('id', memberId)
    .single()

  const compliance = Number(member?.compliance_rate ?? 0)
  if (compliance < rules.loan_eligibility_min_compliance) {
    reasons.push(`Compliance rate ${compliance}% is below the required ${rules.loan_eligibility_min_compliance}%`)
  }

  // 2. Minimum membership months
  if (member?.date_joined) {
    const monthsActive = Math.floor(
      (Date.now() - new Date(member.date_joined).getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    if (monthsActive < rules.loan_eligibility_min_months) {
      reasons.push(`Only ${monthsActive} month(s) of membership (minimum: ${rules.loan_eligibility_min_months})`)
    }
  }

  // 3. No outstanding loans
  if (rules.no_loan_if_outstanding) {
    const { count } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('member_id',  memberId)
      .eq('stokvel_id', stokvelId)
      .in('status', ['active', 'overdue'])

    if ((count ?? 0) > 0) {
      reasons.push('Member has an outstanding loan that must be repaid first')
    }
  }

  // 4. Stokvel loan book health
  const { data: stokvel } = await supabase
    .from('stokvels')
    .select('total_funds')
    .eq('id', stokvelId)
    .single()

  const totalFunds = Number(stokvel?.total_funds ?? 0)

  const { data: activeLoans } = await supabase
    .from('loans')
    .select('balance_outstanding')
    .eq('stokvel_id', stokvelId)
    .in('status', ['active', 'overdue'])

  const currentLoanBook = (activeLoans || []).reduce((s, l) => s + Number(l.balance_outstanding), 0)
  const maxLoanBook     = (totalFunds * rules.max_loan_percent_of_funds) / 100
  const available       = Math.max(0, maxLoanBook - currentLoanBook)

  if (requestedAmount > available) {
    reasons.push(`Stokvel can only lend R${available.toFixed(0)} more (loan book limit: ${rules.max_loan_percent_of_funds}% of total funds)`)
  }

  // 5. Max loan amount cap
  const maxByRule = rules.max_loan_amount ?? Infinity
  const maxAmount = Math.min(available, maxByRule)

  if (rules.max_loan_amount && requestedAmount > rules.max_loan_amount) {
    reasons.push(`Requested amount exceeds maximum loan of R${rules.max_loan_amount}`)
  }

  return {
    eligible:  reasons.length === 0,
    reasons,
    maxAmount: Math.round(maxAmount),
  }
}

// ── Calculate loan repayment schedule ─────────────────────────
export interface LoanSchedule {
  totalRepayable:     number
  monthlyInstallment: number
  months:             number
  interestAmount:     number
  endDate:            string
}

export function calculateLoanSchedule(
  principal: number,
  rules:     ExtractedRules,
  months?:   number
): LoanSchedule {
  const repaymentMonths = Math.min(months ?? rules.max_loan_months, rules.max_loan_months)
  const monthlyRate     = rules.interest_rate_percent / 100
  const interest        = principal * monthlyRate * repaymentMonths
  const totalRepayable  = principal + interest
  const monthly         = Math.ceil((totalRepayable / repaymentMonths) * 100) / 100

  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + repaymentMonths)

  return {
    totalRepayable:     Math.round(totalRepayable * 100) / 100,
    monthlyInstallment: monthly,
    months:             repaymentMonths,
    interestAmount:     Math.round(interest * 100) / 100,
    endDate:            endDate.toISOString().split('T')[0],
  }
}

// ── Apply a late penalty as a contribution record ──────────────
export async function applyLatePenalty(
  stokvelId:        string,
  memberId:         string,
  penaltyAmount:    number,
  originalReceiptNo: string
): Promise<void> {
  if (penaltyAmount <= 0) return
  const supabase = getSupabase()

  const receiptNumber = `PEN-${originalReceiptNo}`
  await supabase.from('contributions').insert({
    stokvel_id:     stokvelId,
    member_id:      memberId,
    amount:         penaltyAmount,
    payment_date:   new Date().toISOString().split('T')[0],
    payment_method: 'penalty',
    receipt_number: receiptNumber,
    status:         'verified',
    notes:          `Late payment penalty for ${originalReceiptNo}`,
  })
}

// ── Auto-suspend member if threshold crossed ───────────────────
export async function autoSuspendIfNeeded(
  memberId:  string,
  stokvelId: string,
  rules:     ExtractedRules
): Promise<boolean> {
  const supabase = getSupabase()
  const check    = await checkSuspensionThreshold(memberId, stokvelId, rules)

  if (!check.shouldSuspend) return false

  await supabase
    .from('stokvel_members')
    .update({ status: 'suspended' })
    .eq('id', memberId)

  // Log to audit
  await supabase.from('audit_log').insert({
    stokvel_id:  stokvelId,
    actor_name:  'StokvelOS AI (compliance)',
    action:      'member.auto_suspended',
    target_type: 'stokvel_members',
    target_id:   memberId,
    details:     { reason: check.reason, consecutiveMisses: check.consecutiveMisses },
  })

  return true
}
