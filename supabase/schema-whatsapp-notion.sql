-- ============================================================
-- StokvelOS — WhatsApp + Notion + Loans Schema Migration
-- Run in Supabase SQL Editor after schema-full.sql
-- ============================================================

-- ── Add WhatsApp / Notion fields to stokvels ──────────────────
ALTER TABLE public.stokvels
  ADD COLUMN IF NOT EXISTS whatsapp_number         TEXT,
  ADD COLUMN IF NOT EXISTS chairperson_phone        TEXT,
  ADD COLUMN IF NOT EXISTS active                   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS member_count             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_funds              DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notion_workspace_id      TEXT,
  ADD COLUMN IF NOT EXISTS notion_contributions_db_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_members_db_id     TEXT,
  ADD COLUMN IF NOT EXISTS notion_loans_db_id       TEXT,
  ADD COLUMN IF NOT EXISTS notion_payouts_db_id     TEXT,
  ADD COLUMN IF NOT EXISTS contribution_due_day     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payout_type              TEXT DEFAULT 'rotating',
  ADD COLUMN IF NOT EXISTS constitution_text        TEXT,
  ADD COLUMN IF NOT EXISTS chairperson_id           UUID REFERENCES public.profiles(id);

-- ── Add fields to stokvel_members ────────────────────────────
ALTER TABLE public.stokvel_members
  ADD COLUMN IF NOT EXISTS full_name            TEXT,
  ADD COLUMN IF NOT EXISTS id_number            TEXT,
  ADD COLUMN IF NOT EXISTS date_joined          DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS total_contributed    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_received       DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_balance         DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_rate      DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS notion_page_id       TEXT;

-- ── Add receipt_number + payment_date to contributions ───────
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS receipt_number  TEXT,
  ADD COLUMN IF NOT EXISTS payment_date    DATE,
  ADD COLUMN IF NOT EXISTS payment_method  TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS proof_url       TEXT,
  ADD COLUMN IF NOT EXISTS notion_page_id  TEXT;

-- Backfill payment_date from existing date column
UPDATE public.contributions SET payment_date = date WHERE payment_date IS NULL;

-- ── Add receipt_number to payouts ────────────────────────────
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS receipt_number  TEXT,
  ADD COLUMN IF NOT EXISTS payout_date     DATE,
  ADD COLUMN IF NOT EXISTS payout_method   TEXT,
  ADD COLUMN IF NOT EXISTS proof_url       TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by     UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS notion_page_id  TEXT;

UPDATE public.payouts SET payout_date = date WHERE payout_date IS NULL;

-- ── Loans ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id           UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id            UUID NOT NULL REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount               DECIMAL(10,2) NOT NULL,
  interest_rate        DECIMAL(5,2) DEFAULT 0,
  total_repayable      DECIMAL(10,2) NOT NULL,
  repayment_months     INTEGER NOT NULL,
  monthly_installment  DECIMAL(10,2) NOT NULL,
  balance_outstanding  DECIMAL(10,2) NOT NULL,
  status               TEXT DEFAULT 'pending',  -- 'pending'|'active'|'paid'|'overdue'|'defaulted'
  approved_by          UUID REFERENCES public.stokvel_members(id),
  approval_date        DATE,
  start_date           DATE,
  end_date             DATE,
  notion_page_id       TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Loan Repayments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id         UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  stokvel_id      UUID REFERENCES public.stokvels(id),
  amount          DECIMAL(10,2) NOT NULL,
  payment_date    DATE NOT NULL,
  receipt_number  TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Fraud Alerts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id   UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES public.stokvel_members(id),
  alert_type   TEXT NOT NULL,   -- 'duplicate_payment'|'balance_discrepancy'|'unusual_pattern'|'overdue_loan'|'rapid_payments'
  severity     TEXT DEFAULT 'medium',  -- 'low'|'medium'|'high'|'critical'
  description  TEXT NOT NULL,
  evidence     JSONB DEFAULT '{}',
  status       TEXT DEFAULT 'open',   -- 'open'|'investigating'|'resolved'|'false_alarm'
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── WhatsApp Message Log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID REFERENCES public.stokvels(id),
  member_id   UUID REFERENCES public.stokvel_members(id),
  phone       TEXT NOT NULL,
  direction   TEXT NOT NULL,     -- 'inbound'|'outbound'
  content     TEXT NOT NULL,
  intent      TEXT,              -- classified by Claude
  tokens_used INTEGER DEFAULT 0,
  from_cache  BOOLEAN DEFAULT false,
  message_id  TEXT UNIQUE,       -- 360dialog message ID (deduplication)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS for new tables ────────────────────────────────────────
ALTER TABLE public.loans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_admin" ON public.loans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = loans.stokvel_id AND admin_id = auth.uid())
  );

CREATE POLICY "loan_repayments_admin" ON public.loan_repayments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = loan_repayments.stokvel_id AND admin_id = auth.uid())
  );

CREATE POLICY "fraud_alerts_admin" ON public.fraud_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = fraud_alerts.stokvel_id AND admin_id = auth.uid())
  );

CREATE POLICY "whatsapp_messages_admin" ON public.whatsapp_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = whatsapp_messages.stokvel_id AND admin_id = auth.uid())
  );

-- Service role bypass for webhook (inserts from API without auth session)
CREATE POLICY "whatsapp_messages_service" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_stokvel         ON public.loans(stokvel_id);
CREATE INDEX IF NOT EXISTS idx_loans_member          ON public.loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status          ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_stokvel  ON public.fraud_alerts(stokvel_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status   ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON public.fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone      ON public.whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_stokvel    ON public.whatsapp_messages(stokvel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_receipt ON public.contributions(receipt_number);
