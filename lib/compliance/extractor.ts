// lib/compliance/extractor.ts
// One-time Claude extraction of rules from a stokvel's constitution.
// Called once on setup (or when constitution is updated).
// After extraction, enforcement is pure database logic — zero Claude cost.

import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ExtractedRules {
  // Contributions
  monthly_amount:              number | null
  contribution_due_day:        number           // 1-31
  late_grace_days:             number           // days after due before penalty kicks in
  late_penalty_type:           'percent' | 'fixed'
  late_penalty_percent:        number           // % of contribution
  late_penalty_fixed:          number | null    // fixed rand amount
  // Membership
  suspension_threshold_months: number           // consecutive misses before suspension
  early_exit_penalty_percent:  number | null    // % of total contributed
  // Loans
  loans_allowed:               boolean
  loan_eligibility_min_compliance: number       // min compliance % to qualify
  loan_eligibility_min_months: number           // months of membership required
  max_loan_amount:             number | null    // cap in rands (null = no cap)
  max_loan_percent_of_funds:   number           // max % of total funds to lend out
  interest_rate_percent:       number           // per month
  max_loan_months:             number           // max repayment period
  no_loan_if_outstanding:      boolean          // can't have 2 loans at once
  // Governance
  quorum_percent:              number           // % of members needed for valid meeting
  chairperson_co_sign_above:   number           // transactions above this need chairperson
  // Payouts
  payout_type:                 'rotating' | 'year_end' | 'event_based'
  // Meta
  extracted_at:                string
  source:                      'constitution' | 'defaults'
}

const SAFE_DEFAULTS: ExtractedRules = {
  monthly_amount:              null,
  contribution_due_day:        1,
  late_grace_days:             7,
  late_penalty_type:           'percent',
  late_penalty_percent:        10,
  late_penalty_fixed:          null,
  suspension_threshold_months: 3,
  early_exit_penalty_percent:  null,
  loans_allowed:               true,
  loan_eligibility_min_compliance: 80,
  loan_eligibility_min_months: 3,
  max_loan_amount:             null,
  max_loan_percent_of_funds:   30,
  interest_rate_percent:       20,
  max_loan_months:             6,
  no_loan_if_outstanding:      true,
  quorum_percent:              60,
  chairperson_co_sign_above:   1000,
  payout_type:                 'rotating',
  extracted_at:                new Date().toISOString(),
  source:                      'defaults',
}

export async function extractRulesFromConstitution(
  constitutionText: string,
  stokvelId: string
): Promise<ExtractedRules> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let rules: ExtractedRules = { ...SAFE_DEFAULTS, extracted_at: new Date().toISOString() }

  if (!constitutionText?.trim()) {
    rules.source = 'defaults'
  } else {
    try {
      const response = await anthropic.messages.create({
        model:     'claude-sonnet-4-6',
        max_tokens: 800,
        system: `You are extracting enforceable rules from a South African stokvel constitution.
Extract ONLY rules that are explicitly stated. For any rule not mentioned, return null.
Respond ONLY with a valid JSON object matching this exact structure (no markdown, no explanation):
{
  "monthly_amount": number|null,
  "contribution_due_day": number,
  "late_grace_days": number,
  "late_penalty_type": "percent"|"fixed",
  "late_penalty_percent": number,
  "late_penalty_fixed": number|null,
  "suspension_threshold_months": number,
  "early_exit_penalty_percent": number|null,
  "loans_allowed": boolean,
  "loan_eligibility_min_compliance": number,
  "loan_eligibility_min_months": number,
  "max_loan_amount": number|null,
  "max_loan_percent_of_funds": number,
  "interest_rate_percent": number,
  "max_loan_months": number,
  "no_loan_if_outstanding": boolean,
  "quorum_percent": number,
  "chairperson_co_sign_above": number,
  "payout_type": "rotating"|"year_end"|"event_based"
}`,
        messages: [{ role: 'user', content: `Extract rules from this constitution:\n\n${constitutionText.slice(0, 6000)}` }],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
      const extracted = JSON.parse(raw.replace(/```json|```/g, '').trim())

      // Merge with defaults — extracted values override defaults, nulls keep defaults
      rules = {
        ...SAFE_DEFAULTS,
        ...Object.fromEntries(
          Object.entries(extracted).filter(([, v]) => v !== null && v !== undefined)
        ),
        extracted_at: new Date().toISOString(),
        source:       'constitution',
      } as ExtractedRules
    } catch (err) {
      console.error('[extractor] Claude extraction failed, using defaults:', err)
      rules.source = 'defaults'
    }
  }

  // Persist to Supabase
  await supabase
    .from('stokvels')
    .update({ extracted_rules: rules, rules_extracted_at: rules.extracted_at })
    .eq('id', stokvelId)

  return rules
}

export function getDefaultRules(): ExtractedRules {
  return { ...SAFE_DEFAULTS, extracted_at: new Date().toISOString() }
}
