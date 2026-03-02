// lib/payfast.ts  (REPLACE Batch 2 version — fixes IP list + security)
import crypto from 'crypto'

export const PAYFAST_CONFIG = {
  merchantId:  process.env.PAYFAST_MERCHANT_ID!,
  merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
  passphrase:  process.env.PAYFAST_PASSPHRASE!,
  sandbox:     process.env.PAYFAST_SANDBOX === 'true',
  get baseUrl() {
    return this.sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process'
  },
  get validHostsUrl() {
    return this.sandbox
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate'
  },
}

// ── Current PayFast IP ranges (updated 2025) ─────────────────
// Source: https://developers.payfast.co.za/docs#notify
const PAYFAST_IP_RANGES = [
  // Production IPs
  '197.97.145.144', '197.97.145.145', '197.97.145.146', '197.97.145.147',
  '41.74.179.194',
  // Sandbox / localhost for testing
  '127.0.0.1', '::1', '0:0:0:0:0:0:0:1',
]

// ── Plans ─────────────────────────────────────────────────────
export const PLANS = {
  basic: {
    id:          'basic',
    name:        'Basic',
    amount:      199,
    description: 'StokvelOS Basic — Up to 20 members',
    maxMembers:  20,
  },
  premium: {
    id:          'premium',
    name:        'Premium',
    amount:      499,
    description: 'StokvelOS Premium — Unlimited members + full AI',
    maxMembers:  Infinity,
  },
} as const

// ── Signature generation ──────────────────────────────────────
export function generateSignature(data: Record<string, string>, passphrase?: string): string {
  const params = { ...data }
  if (passphrase) params.passphrase = passphrase

  const paramString = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&')

  return crypto.createHash('md5').update(paramString).digest('hex')
}

// ── Build subscription payment data ──────────────────────────
export interface SubscriptionPaymentData {
  userId:      string
  stokvelId:   string
  stokvelName: string
  email:       string
  planId:      'basic' | 'premium'
}

export function buildSubscriptionData(input: SubscriptionPaymentData) {
  const plan    = PLANS[input.planId]
  const appUrl  = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL!
  const now     = new Date().toISOString()

  const data: Record<string, string> = {
    merchant_id:       PAYFAST_CONFIG.merchantId,
    merchant_key:      PAYFAST_CONFIG.merchantKey,
    return_url:        `${appUrl}/pricing?payment=success`,
    cancel_url:        `${appUrl}/pricing?payment=cancelled`,
    notify_url:        `${appUrl}/api/payfast/notify`,

    name_first:        input.email.split('@')[0],
    email_address:     input.email,

    item_name:         plan.description,
    item_description:  `${plan.name} plan for ${input.stokvelName}`,
    amount:            plan.amount.toFixed(2),

    // Recurring subscription
    subscription_type: '1',
    billing_date:      now.split('T')[0],
    recurring_amount:  plan.amount.toFixed(2),
    frequency:         '3',   // Monthly
    cycles:            '0',   // Indefinite

    // Custom fields for ITN handler
    custom_str1:       input.userId,
    custom_str2:       input.planId,
    custom_str3:       input.stokvelId,
  }

  data.signature = generateSignature(data, PAYFAST_CONFIG.passphrase)
  return { data, actionUrl: PAYFAST_CONFIG.baseUrl }
}

// ── ITN type ──────────────────────────────────────────────────
export interface PayFastITN {
  m_payment_id:     string
  pf_payment_id:    string
  payment_status:   string
  item_name:        string
  amount_gross:     string
  amount_fee:       string
  amount_net:       string
  signature:        string
  token?:           string
  billing_date?:    string
  custom_str1?:     string  // userId
  custom_str2?:     string  // planId
  custom_str3?:     string  // stokvelId
  [key: string]:    string | undefined
}

// ── Validate ITN ──────────────────────────────────────────────
export async function validateITN(
  data:      PayFastITN,
  rawBody:   string,
  sourceIp:  string
): Promise<{ valid: boolean; reason?: string }> {

  // 1. IP check
  if (!PAYFAST_CONFIG.sandbox && !PAYFAST_IP_RANGES.includes(sourceIp)) {
    return { valid: false, reason: `Untrusted IP: ${sourceIp}` }
  }

  // 2. Signature check
  const { signature, ...rest } = data
  const expected = generateSignature(
    Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Record<string, string>,
    PAYFAST_CONFIG.passphrase
  )
  if (signature !== expected) {
    return { valid: false, reason: 'Signature mismatch' }
  }

  // 3. Server-side validation with PayFast
  try {
    const res = await fetch(PAYFAST_CONFIG.validHostsUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    rawBody,
    })
    const text = await res.text()
    if (!text.includes('VALID')) {
      return { valid: false, reason: `PayFast validation failed: ${text}` }
    }
  } catch (err) {
    // If PayFast server is unreachable, trust signature check only in sandbox
    if (!PAYFAST_CONFIG.sandbox) {
      return { valid: false, reason: 'Could not reach PayFast validation server' }
    }
    console.warn('[PayFast] Validation server unreachable, trusting signature in sandbox mode')
  }

  return { valid: true }
}
