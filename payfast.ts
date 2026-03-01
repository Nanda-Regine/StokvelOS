// ============================================================
// StokvelOS — PayFast Integration
// South Africa's leading payment gateway
// Docs: https://developers.payfast.co.za
// ============================================================

import crypto from 'crypto'

// ── Config ───────────────────────────────────────────────────
export const PAYFAST_CONFIG = {
  merchantId:  process.env.PAYFAST_MERCHANT_ID!,
  merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
  passphrase:  process.env.PAYFAST_PASSPHRASE || '',
  sandbox:     process.env.PAYFAST_SANDBOX === 'true',
}

export const PAYFAST_URLS = {
  payment: (sandbox: boolean) =>
    sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process',
  validate: (sandbox: boolean) =>
    sandbox
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate',
}

// ── Subscription Plans ────────────────────────────────────────
export const PLANS = {
  basic: {
    id:          'basic',
    name:        'Basic',
    amount:      199,
    description: 'StokvelOS Basic — Up to 20 members',
    billingDate:  1, // 1st of each month
    cycles:      0,  // 0 = indefinite
  },
  premium: {
    id:          'premium',
    name:        'Premium',
    amount:      499,
    description: 'StokvelOS Premium — Unlimited members + full AI',
    billingDate:  1,
    cycles:      0,
  },
} as const

export type PlanId = keyof typeof PLANS

// ── Signature generation ──────────────────────────────────────
export function generateSignature(
  data: Record<string, string>,
  passphrase?: string
): string {
  // Sort keys alphabetically, build query string
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      if (data[key] !== '' && data[key] !== undefined) {
        acc[key] = data[key]
      }
      return acc
    }, {})

  let queryString = Object.entries(sorted)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&')

  if (passphrase) {
    queryString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
  }

  return crypto.createHash('md5').update(queryString).digest('hex')
}

// ── Build subscription payment data ──────────────────────────
export interface SubscriptionPaymentData {
  userId:      string
  userEmail:   string
  userName:    string
  planId:      PlanId
  stokvelName: string
  returnUrl:   string
  cancelUrl:   string
  notifyUrl:   string
}

export function buildSubscriptionData(input: SubscriptionPaymentData) {
  const plan    = PLANS[input.planId]
  const today   = new Date()
  const billing = new Date(today.getFullYear(), today.getMonth() + 1, plan.billingDate)
    .toISOString()
    .split('T')[0]

  const data: Record<string, string> = {
    merchant_id:      PAYFAST_CONFIG.merchantId,
    merchant_key:     PAYFAST_CONFIG.merchantKey,
    return_url:       input.returnUrl,
    cancel_url:       input.cancelUrl,
    notify_url:       input.notifyUrl,
    name_first:       input.userName.split(' ')[0] || input.userName,
    name_last:        input.userName.split(' ').slice(1).join(' ') || '',
    email_address:    input.userEmail,
    m_payment_id:     `${input.planId}_${input.userId}_${Date.now()}`,
    amount:           plan.amount.toFixed(2),
    item_name:        plan.description,
    item_description: `${plan.name} plan for ${input.stokvelName}`,
    // Subscription fields
    subscription_type: '1',        // recurring
    billing_date:       billing,
    recurring_amount:  plan.amount.toFixed(2),
    frequency:         '3',        // monthly
    cycles:            String(plan.cycles),
    // Custom data
    custom_str1: input.userId,
    custom_str2: input.planId,
    custom_str3: input.stokvelName,
  }

  // Remove empty strings
  Object.keys(data).forEach(k => { if (!data[k]) delete data[k] })

  const signature = generateSignature(data, PAYFAST_CONFIG.passphrase)

  return { ...data, signature }
}

// ── Validate ITN (Instant Transaction Notification) ───────────
export interface PayFastITN {
  m_payment_id:      string
  pf_payment_id:     string
  payment_status:    string
  item_name:         string
  amount_gross:      string
  amount_fee:        string
  amount_net:        string
  custom_str1:       string  // userId
  custom_str2:       string  // planId
  custom_str3:       string  // stokvelName
  name_first:        string
  name_last:         string
  email_address:     string
  merchant_id:       string
  signature:         string
  token?:            string  // subscription token
  billing_date?:     string
  [key: string]:     string | undefined
}

export async function validateITN(
  data: PayFastITN,
  rawBody: string,
  sourceIp: string
): Promise<{ valid: boolean; reason?: string }> {

  // 1. Verify source IP (PayFast IPs)
  const PAYFAST_IPS = [
    '197.97.145.144', '197.97.145.145', '197.97.145.146', '197.97.145.147',
    // Sandbox
    '127.0.0.1', '::1',
  ]
  if (!PAYFAST_IPS.includes(sourceIp) && !PAYFAST_CONFIG.sandbox) {
    return { valid: false, reason: `Invalid source IP: ${sourceIp}` }
  }

  // 2. Verify signature
  const { signature, ...dataWithoutSig } = data
  const cleanData = Object.entries(dataWithoutSig)
    .reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== '') acc[k] = v
      return acc
    }, {})

  const expectedSig = generateSignature(cleanData, PAYFAST_CONFIG.passphrase)
  if (signature !== expectedSig) {
    return { valid: false, reason: 'Signature mismatch' }
  }

  // 3. Verify with PayFast server
  try {
    const validateUrl = PAYFAST_URLS.validate(PAYFAST_CONFIG.sandbox)
    const response = await fetch(validateUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    rawBody,
    })
    const text = await response.text()
    if (text.trim() !== 'VALID') {
      return { valid: false, reason: `PayFast validation returned: ${text}` }
    }
  } catch (err) {
    return { valid: false, reason: `Validation request failed: ${err}` }
  }

  // 4. Verify merchant ID
  if (data.merchant_id !== PAYFAST_CONFIG.merchantId) {
    return { valid: false, reason: 'Merchant ID mismatch' }
  }

  return { valid: true }
}

// ── Subscription status from Supabase columns ─────────────────
export type SubscriptionStatus = 'free' | 'basic' | 'premium' | 'expired' | 'cancelled'

export interface Subscription {
  status:        SubscriptionStatus
  planId:        PlanId | null
  pfToken:       string | null
  billingDate:   string | null
  nextBilling:   string | null
  cancelledAt:   string | null
}
