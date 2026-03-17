-- ============================================================
-- StokvelOS — AI Agents Schema
-- Run after schema-whatsapp-notion.sql
-- ============================================================

-- ── Extracted constitution rules (one per stokvel) ────────────
ALTER TABLE public.stokvels
  ADD COLUMN IF NOT EXISTS extracted_rules    JSONB,
  ADD COLUMN IF NOT EXISTS rules_extracted_at TIMESTAMPTZ;

-- ── Pending confirmations (stateful WhatsApp transactions) ───
-- Stores intent between "Paid R500" and "YES" reply
CREATE TABLE IF NOT EXISTS public.pending_confirmations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  intent      TEXT NOT NULL,        -- 'record_payment' | 'loan_request' | 'payout' | 'suspend'
  payload     JSONB NOT NULL,       -- full action payload to execute on YES
  prompt_text TEXT NOT NULL,        -- what was asked for confirmation
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Disputes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id       UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  complainant_id   UUID NOT NULL REFERENCES public.stokvel_members(id),
  respondent_id    UUID REFERENCES public.stokvel_members(id), -- null = dispute against stokvel records
  subject          TEXT NOT NULL,
  amount           DECIMAL(10,2),
  resource_type    TEXT,             -- 'contribution' | 'payout' | 'loan' | 'general'
  resource_id      UUID,
  state            TEXT DEFAULT 'open',
  -- 'open' | 'investigating' | 'awaiting_complainant_proof'
  -- | 'awaiting_respondent_proof' | 'reviewing' | 'resolved' | 'escalated'
  awaiting_phone   TEXT,             -- whose reply we're waiting for
  resolution       TEXT,
  evidence         JSONB DEFAULT '{}',
  conversation     JSONB DEFAULT '[]',  -- [{role, content, ts}]
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  escalated_at     TIMESTAMPTZ
);

-- ── Nightly risk snapshots ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_snapshots (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id           UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  snapshot_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  risk_level           TEXT DEFAULT 'low',   -- 'low' | 'medium' | 'high' | 'critical'
  compliance_rate      DECIMAL(5,2),
  compliance_trend     TEXT,                 -- 'improving' | 'stable' | 'declining'
  projected_collection DECIMAL(10,2),
  expected_collection  DECIMAL(10,2),
  loan_book_percent    DECIMAL(5,2),         -- loans as % of total funds
  members_at_risk      INTEGER DEFAULT 0,    -- near suspension threshold
  alerts               JSONB DEFAULT '[]',   -- [{type, message, severity}]
  ai_summary           TEXT,
  notified_at          TIMESTAMPTZ,          -- when chairperson was WhatsApped
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stokvel_id, snapshot_date)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.pending_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_snapshots        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_conf_service" ON public.pending_confirmations FOR ALL USING (true);

CREATE POLICY "disputes_admin" ON public.disputes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = disputes.stokvel_id AND admin_id = auth.uid())
  );

CREATE POLICY "risk_snapshots_admin" ON public.risk_snapshots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stokvels WHERE id = risk_snapshots.stokvel_id AND admin_id = auth.uid())
  );

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pending_conf_phone   ON public.pending_confirmations(phone);
CREATE INDEX IF NOT EXISTS idx_pending_conf_expires ON public.pending_confirmations(expires_at);
CREATE INDEX IF NOT EXISTS idx_disputes_stokvel     ON public.disputes(stokvel_id);
CREATE INDEX IF NOT EXISTS idx_disputes_state       ON public.disputes(state);
CREATE INDEX IF NOT EXISTS idx_disputes_complainant ON public.disputes(complainant_id);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_stokvel ON public.risk_snapshots(stokvel_id, snapshot_date DESC);
