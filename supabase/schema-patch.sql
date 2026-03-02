-- ============================================================
-- StokvelOS — Schema Patch (Batch 5)
-- Run this AFTER schema.sql and schema-subscriptions.sql
-- ============================================================

-- ── Fix: missing updated_at trigger on contributions ─────────
CREATE TRIGGER contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Fix: missing columns on stokvels ─────────────────────────
ALTER TABLE public.stokvels
  ADD COLUMN IF NOT EXISTS logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS constitution   TEXT,
  ADD COLUMN IF NOT EXISTS bank_name      TEXT,
  ADD COLUMN IF NOT EXISTS bank_account   TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch    TEXT;

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name  TEXT NOT NULL,
  action      TEXT NOT NULL,  -- 'contribution.create' | 'member.edit' | 'payout.record' etc
  target_type TEXT,           -- 'contribution' | 'member' | 'payout' | 'meeting'
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = audit_log.stokvel_id AND admin_id = auth.uid()
    )
  );

CREATE INDEX idx_audit_log_stokvel   ON public.audit_log(stokvel_id);
CREATE INDEX idx_audit_log_created   ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor     ON public.audit_log(actor_id);

-- ── Announcements: add read tracking ─────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Announcements: members can read their stokvel's announcements
CREATE POLICY IF NOT EXISTS "announcements_member_read" ON public.announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvel_members
      WHERE stokvel_id = announcements.stokvel_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ── Member statements view ────────────────────────────────────
-- Used for per-member statement generation
CREATE OR REPLACE VIEW public.member_contribution_summary AS
SELECT
  sm.id                                          AS member_id,
  sm.stokvel_id,
  sm.name                                        AS member_name,
  sm.email,
  sm.phone,
  sm.monthly_amount,
  sm.payout_position,
  sm.status,
  COUNT(c.id)                                    AS total_payments,
  COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'confirmed'), 0) AS total_confirmed,
  COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'),   0) AS total_pending,
  MAX(c.date)                                    AS last_payment_date,
  MIN(c.date)                                    AS first_payment_date
FROM public.stokvel_members sm
LEFT JOIN public.contributions c
  ON c.member_id = sm.id
GROUP BY sm.id, sm.stokvel_id, sm.name, sm.email, sm.phone, sm.monthly_amount, sm.payout_position, sm.status;

-- ── Performance indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contributions_status      ON public.contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_stokvel_date ON public.contributions(stokvel_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_members_status             ON public.stokvel_members(status);
CREATE INDEX IF NOT EXISTS idx_payouts_member             ON public.payouts(member_id);
CREATE INDEX IF NOT EXISTS idx_announcements_stokvel      ON public.announcements(stokvel_id, created_at DESC);

-- ── Scheduled reminders (for Vercel cron) ────────────────────
CREATE TABLE IF NOT EXISTS public.reminder_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- 'YYYY-MM'
  sent_count  INTEGER DEFAULT 0,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stokvel_id, month)
);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_log_admin" ON public.reminder_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = reminder_log.stokvel_id AND admin_id = auth.uid()
    )
  );
