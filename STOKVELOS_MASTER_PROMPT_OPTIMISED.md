# StokvelOS — Master Build Specification for Claude Code (Optimised)

**Project:** AI-powered stokvel management OS — WhatsApp + Web Dashboard  
**Creator:** Nandawula Regine (CreativelyNanda.co.za) · Mirembe Muse (Pty) Ltd  
**Market:** 11 million South Africans · R50 billion informal economy · ~440,000 stokvels  
**Positioning:** "From paper notebooks to digital transparency — your stokvel, protected"  
**Domain:** stokvelos.co.za

---

## THE PROBLEM (why this is urgent)

- 95% of stokvels run on paper notebooks — disputes destroy communities
- Treasurer fraud is rampant (disappears with money, no accountability)
- Zero visibility for members (only admin sees the books)
- Rural and township communities have no access to fintech tools
- One fraud incident destroys friendships, families, and communities built over decades

StokvelOS fixes all of this. Every rand is visible. Every transaction is immutable. The community's trust is protected by technology.

---

## STACK

```
Frontend:    Next.js 14 (App Router) + TypeScript + Tailwind CSS
Database:    Supabase (Postgres + RLS + Realtime + Storage)
Auth:        Supabase Auth (multi-role: chairperson, treasurer, secretary, member)
AI:          Claude API (claude-sonnet-4-6) with prompt caching
WhatsApp:    360dialog (Africa-optimised) — PRIMARY interface for members
Records:     Notion API (transparent shared workspace — all members can view)
Payments:    PayFast (subscription + member contributions)
Future:      MTN MoMo, Vodacom VodaPay, Capitec Pay
PWA:         next-pwa — installable, works on R500 smartphones, low data
Languages:   isiZulu · isiXhosa · Sesotho · Setswana · Afrikaans · English (runtime via Claude)
Domain:      stokvelos.co.za
Hosting:     Vercel
```

---

## ARCHITECTURE

### Primary interface: WhatsApp (members interact here only)
- 90% of rural SA uses WhatsApp — no app download required
- Members send natural language commands: "Balance", "Paid R500", "When is payout?"
- Claude processes commands in the member's language
- Responses are concise (under 300 chars) for data-poor users

### Secondary interface: Notion workspace (auto-deployed per stokvel)
- Shared read access for all members — full transparency
- Only admin can write (via WhatsApp commands)
- Paper can be faked. Notion cannot.

### Tertiary interface: Web dashboard (chairperson/admin only)
- Manage multiple stokvels (umbrella orgs)
- AI insights and fraud alerts
- Subscription management

---

## STOKVEL AI AGENT — SYSTEM PROMPT (cached)

```
You are the StokvelOS AI assistant managing financial records for a stokvel community.

STOKVEL: {stokvel_name}
TYPE: {stokvel_type} — savings club / burial society / investment group / groceries
MEMBERS: {member_count} active members
CONTRIBUTION: R{monthly_amount} per month, due on the {due_day}th
PAYOUT SCHEDULE: {payout_schedule}
RULES: {constitution_summary}

YOUR ROLE:
You are the trusted, neutral record-keeper of this community. You are not aligned with any one member. Your job is to protect the community's money, trust, and harmony.

LANGUAGE:
Detect which language the member writes in and respond in that language naturally.
Support: isiZulu, isiXhosa, Sesotho, Setswana, siSwati, Tshivenda, Xitsonga, Afrikaans, English.
Code-switch naturally like township communities do.

TONE:
Warm, trustworthy, community-focused. You understand ubuntu — the community comes first.
Never robotic. Never cold. This is their money and their community.

SECURITY:
Every transaction requires confirmation before recording.
Large transactions (over R1,000) require chairperson co-confirmation.
Always generate a receipt number for every confirmed transaction.
Never process a transaction without explicit member confirmation (YES/CONFIRM).

FRAUD AWARENESS:
Flag: duplicate payments, unusual amounts, members claiming payments with no matching proof.
Alert the chairperson immediately for any discrepancy.
Keep an audit trail of every action.

RESPONSE FORMAT FOR WHATSAPP:
Keep all responses under 300 characters unless generating a report.
Use emoji sparingly but warmly (✅ for confirmed, ❌ for errors, 💰 for money, 📊 for reports).
Always end with a clear next action for the member.
```

---

## DATABASE SCHEMA

```sql
-- Stokvels (one per group)
CREATE TABLE public.stokvels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,                 -- 'savings' | 'burial' | 'investment' | 'groceries' | 'hybrid'
  monthly_amount DECIMAL(10,2) NOT NULL,
  contribution_due_day INTEGER DEFAULT 1,
  payout_type TEXT DEFAULT 'rotating', -- 'rotating' | 'year_end' | 'event_based'
  member_count INTEGER DEFAULT 0,
  total_funds DECIMAL(10,2) DEFAULT 0,
  plan TEXT DEFAULT 'standard',
  whatsapp_number TEXT,
  notion_workspace_id TEXT,
  notion_contributions_db_id TEXT,
  notion_members_db_id TEXT,
  notion_loans_db_id TEXT,
  notion_payouts_db_id TEXT,
  constitution_text TEXT,             -- uploaded constitution/rules
  chairperson_id UUID,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members
CREATE TABLE public.stokvel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,                -- WhatsApp number
  id_number TEXT,
  role TEXT DEFAULT 'member',         -- 'member' | 'treasurer' | 'chairperson' | 'secretary'
  date_joined DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',       -- 'active' | 'suspended' | 'exited'
  total_contributed DECIMAL(10,2) DEFAULT 0,
  total_received DECIMAL(10,2) DEFAULT 0,
  loan_balance DECIMAL(10,2) DEFAULT 0,
  compliance_rate DECIMAL(5,2) DEFAULT 100,
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributions
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- 'cash' | 'eft' | 'payfast' | 'momo' | 'vodapay'
  proof_url TEXT,
  receipt_number TEXT UNIQUE NOT NULL, -- auto-generated: STK-{stokvel_id_short}-{timestamp}
  status TEXT DEFAULT 'verified',     -- 'verified' | 'pending' | 'disputed'
  recorded_by UUID REFERENCES public.stokvel_members(id),
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payout_date DATE NOT NULL,
  payout_method TEXT,
  proof_url TEXT,
  receipt_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES public.stokvel_members(id),
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loans
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  total_repayable DECIMAL(10,2) NOT NULL,
  repayment_months INTEGER NOT NULL,
  monthly_installment DECIMAL(10,2) NOT NULL,
  balance_outstanding DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',      -- 'pending' | 'active' | 'paid' | 'overdue' | 'defaulted'
  approved_by UUID REFERENCES public.stokvel_members(id),
  approval_date DATE,
  start_date DATE,
  end_date DATE,
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan repayments
CREATE TABLE public.loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  stokvel_id UUID REFERENCES public.stokvels(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fraud alerts (auto-generated by AI)
CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.stokvel_members(id),
  alert_type TEXT NOT NULL,           -- 'duplicate_payment' | 'balance_discrepancy' | 'unusual_pattern' | 'overdue_loan'
  severity TEXT DEFAULT 'medium',     -- 'low' | 'medium' | 'high' | 'critical'
  description TEXT NOT NULL,
  evidence JSONB,
  status TEXT DEFAULT 'open',         -- 'open' | 'investigating' | 'resolved' | 'false_alarm'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp message log
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id),
  member_id UUID REFERENCES public.stokvel_members(id),
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,            -- 'inbound' | 'outbound'
  content TEXT NOT NULL,
  intent TEXT,                        -- classified by Claude
  tokens_used INTEGER,
  from_cache BOOLEAN DEFAULT false,
  message_id TEXT UNIQUE,             -- 360dialog message ID (for deduplication)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (immutable)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id UUID REFERENCES public.stokvels(id),
  actor_phone TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## WHATSAPP COMMAND FLOWS

### Member commands (any member)

```
"Balance" / "Bakho" / "Balanse"
→ Pull member's contribution summary from Supabase
→ Show: total contributed, last payment date, next due date, compliance rate, payout position

"Paid R500" / "Ngikhokhile R500"
→ Claude confirms: amount, date, method
→ Member replies YES to confirm
→ Record contribution, generate receipt, update Notion, notify chairperson

"Loan R2000" / "Ngidinga umboleko"
→ Check eligibility (compliance rate > 80%, no outstanding loans)
→ Show repayment terms
→ Forward to chairperson for approval

"When is payout?" / "Nini ukukhokhelwa?"
→ Show payout schedule, member's position, estimated amount

"Report" / "Umbiko"
→ Send member's personal financial summary

"Help" / "Usizo"
→ Show available commands in member's language
```

### Admin commands (chairperson / treasurer only)

```
"Approve loan [member name]"
→ Verify admin role (JWT + database check)
→ Activate loan, notify member, update Notion

"Payout R5000 to [member name]"
→ Require confirmation
→ Record payout, generate receipt, notify member, update Notion

"Monthly report"
→ Generate comprehensive report: collections, payouts, compliance, alerts
→ Send Notion link with full breakdown

"Suspend [member name]"
→ Require confirmation with reason
→ Update member status, notify member

"Members"
→ Full member list with compliance rates

"Fraud check"
→ Run fraud detection on recent transactions
→ Flag discrepancies
```

---

## NOTION INTEGRATION

```typescript
// /lib/notion/workspace.ts
// Auto-deploy a full Notion workspace when a stokvel subscribes

export async function deployNotionWorkspace(stokvelId: string, stokvelName: string) {
  // 1. Create workspace (via Notion API)
  // 2. Deploy 6 databases from templates:
  //    - Members database
  //    - Contributions database  
  //    - Loans database
  //    - Payouts database
  //    - Fraud alerts database
  //    - Monthly reports database
  // 3. Set sharing to "anyone with link can view" (read only)
  // 4. Store all database IDs in Supabase
  // 5. Return workspace invite link for chairperson
  
  const databases = await Promise.all([
    createMembersDatabase(parentPageId, stokvelName),
    createContributionsDatabase(parentPageId),
    createLoansDatabase(parentPageId),
    createPayoutsDatabase(parentPageId),
    createReportsDatabase(parentPageId),
  ])
  
  await supabase.from('stokvels').update({
    notion_workspace_id: workspace.id,
    notion_contributions_db_id: databases.contributions.id,
    notion_members_db_id: databases.members.id,
    notion_loans_db_id: databases.loans.id,
    notion_payouts_db_id: databases.payouts.id,
  }).eq('id', stokvelId)
  
  return workspace.shareableUrl
}

// Every transaction syncs to Notion in real time
export async function syncContributionToNotion(contribution: Contribution) {
  await notion.pages.create({
    parent: { database_id: contribution.stokvel.notion_contributions_db_id },
    properties: {
      'Member': { relation: [{ id: contribution.member.notion_page_id }] },
      'Amount': { number: contribution.amount },
      'Date': { date: { start: contribution.payment_date } },
      'Receipt': { rich_text: [{ text: { content: contribution.receipt_number } }] },
      'Status': { select: { name: contribution.status } },
      'Method': { select: { name: contribution.payment_method } },
    }
  })
}
```

---

## FRAUD DETECTION ENGINE

```typescript
// /lib/fraud/detector.ts
// Runs after every contribution is recorded

export async function runFraudDetection(stokvelId: string, newContribution: Contribution) {
  const alerts = []
  
  // 1. Duplicate payment check (same member, same amount, same day)
  const duplicate = await checkDuplicatePayment(stokvelId, newContribution)
  if (duplicate) alerts.push({ type: 'duplicate_payment', severity: 'high', evidence: duplicate })
  
  // 2. Unusual amount check (>3x normal contribution)
  if (newContribution.amount > newContribution.member.expectedAmount * 3) {
    alerts.push({ type: 'unusual_amount', severity: 'medium' })
  }
  
  // 3. Balance discrepancy check (sum of contributions ≠ recorded balance)
  const calculatedBalance = await calculateExpectedBalance(stokvelId)
  const recordedBalance = await getRecordedBalance(stokvelId)
  if (Math.abs(calculatedBalance - recordedBalance) > 1) {
    alerts.push({ type: 'balance_discrepancy', severity: 'critical', evidence: { calculatedBalance, recordedBalance } })
  }
  
  // 4. Rapid-fire contribution (same member, multiple payments in 1 hour)
  const recentPayments = await getRecentPaymentsByMember(newContribution.member_id, 60)
  if (recentPayments.length > 2) {
    alerts.push({ type: 'rapid_payments', severity: 'high' })
  }
  
  // Store and notify chairperson for any alerts
  for (const alert of alerts) {
    await storeFraudAlert(stokvelId, alert)
    await notifyChairpersonViaWhatsApp(stokvelId, alert)
  }
  
  return alerts
}
```

---

## AUTOMATED CRON JOBS

```typescript
// vercel.json cron config
{
  "crons": [
    { "path": "/api/cron/contribution-reminders", "schedule": "0 9 * * *" },    // 9AM daily
    { "path": "/api/cron/loan-overdue-check",    "schedule": "0 8 * * MON" },   // 8AM Mondays
    { "path": "/api/cron/monthly-reports",       "schedule": "0 7 1 * *" },     // 7AM 1st of month
    { "path": "/api/cron/compliance-update",     "schedule": "0 6 * * *" },     // 6AM daily
  ]
}

// Contribution reminder (3 days before due date)
async function sendContributionReminders() {
  const upcomingDue = await getMembersDueIn3Days()
  for (const member of upcomingDue) {
    await sendWhatsApp(member.phone,
      `Hi ${member.first_name}! 👋 Your stokvel contribution of R${member.expected_amount} is due on ${member.due_date}. Reply "PAID R${member.expected_amount}" once you've paid. 💰`
    )
  }
}
```

---

## ONBOARDING FLOW (chairperson, 20 minutes to live)

```
Step 1: stokvelos.co.za → Create stokvel
  - Stokvel name, type (savings/burial/investment/groceries)
  - Number of members, monthly contribution amount
  - Contribution due date (e.g. 1st of each month)
  - Payout schedule (rotating / year-end / event-based)
  - Upload constitution PDF (optional — Claude extracts rules)
  - Choose plan: Basic R800 / Standard R1,200 / Premium R1,800

Step 2: Pay via PayFast → Notion workspace auto-deployed

Step 3: Add members
  - Enter names and phone numbers
  - OR share a WhatsApp link — members register themselves
  - Set roles (treasurer, secretary, chairperson)

Step 4: Go live
  - Chairperson receives the stokvel's WhatsApp number
  - Share with members: "Send 'Hi' to +27XXXXXXXXX to join your digital stokvel"
  - Notion workspace link shared with all members (view-only)

Step 5: First transaction test
  - Chairperson sends "Balance" — bot responds with zero balance
  - Chairperson sends "Paid R1200" — bot records, Notion updates
  - Chairperson confirms everything works
```

---

## PRICING

```
Basic    R800/mo   — Up to 30 members, basic Notion workspace, monthly reports
Standard R1,200/mo — Up to 50 members, AI fraud detection, automated reminders, loans
Premium  R1,800/mo — Up to 100 members, multi-stokvel, voting, investment tracking, tax reports

Church/community discount: 35% off for verified NPOs and churches
Free 2-month trial: Standard plan, requires 10+ members and valid chairperson ID
```

---

## BATTLETEST CHECKLIST

```
WHATSAPP
□ Responses arrive in under 3 seconds
□ Duplicate message deduplication (same message ID = ignore)
□ Language detection works for Zulu, Xhosa, Sotho inputs
□ Confirmation step required before every transaction
□ Admin commands rejected for non-admin phones
□ Media message handling (proof of payment images)

FRAUD DETECTION
□ Duplicate payment detected and flagged
□ Balance discrepancy triggers critical alert
□ Chairperson receives WhatsApp alert within 60 seconds
□ All fraud alerts stored in audit log

NOTION SYNC
□ Contribution records in Notion within 5 seconds of WhatsApp confirmation
□ Payout records sync correctly
□ Loan records sync with repayment schedule
□ Notion workspace is read-only for members (no edit access)

SECURITY
□ Only chairperson/treasurer can process payouts
□ RLS prevents one stokvel's data being read by another
□ Contribution amounts require member confirmation before recording
□ Audit log is append-only

PAYMENTS
□ PayFast subscription billing works
□ Stokvel suspended after 7-day payment grace period
□ Upgrade/downgrade plans work correctly

REPORTS
□ Monthly report calculates correctly (contributions, payouts, loans, balance)
□ Compliance rate formula: paid on time / total expected × 100
□ Notion report page auto-generated on 1st of each month
```

---

## COMPETITIVE MOAT

1. **WhatsApp-first** — No competitor does this for stokvels specifically
2. **Notion transparency** — Shared record that can't be forged
3. **Multi-language at launch** — Built for how communities actually communicate
4. **Fraud detection** — Automatic protection for the community's money
5. **Ubuntu-coded AI** — Not designed for businesses, designed for community trust
6. **Affordable per person** — R1,200/month ÷ 30 members = R40/person

**This is how you protect 11 million people's savings with technology. Build it right. Build it for them.**
