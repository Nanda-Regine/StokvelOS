-- ============================================================
-- StokvelOS — Complete Database Schema
-- Run this once in Supabase SQL Editor to set up everything.
-- This replaces running schema.sql + schema-subscriptions.sql
-- + schema-patch.sql separately.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (extends Supabase auth.users) ────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Stokvels ──────────────────────────────────────────────────
CREATE TABLE public.stokvels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'general',
  province         TEXT,
  description      TEXT,
  monthly_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payout_frequency TEXT NOT NULL DEFAULT 'monthly',
  payout_order     TEXT NOT NULL DEFAULT 'rotation',
  start_date       DATE,
  admin_id         UUID NOT NULL REFERENCES public.profiles(id),
  -- PayFast / subscription quick-access
  plan_id          TEXT DEFAULT 'free',
  plan_status      TEXT DEFAULT 'free',
  -- Settings fields
  logo_url         TEXT,
  constitution     TEXT,
  bank_name        TEXT,
  bank_account     TEXT,
  bank_branch      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Stokvel Members ───────────────────────────────────────────
CREATE TABLE public.stokvel_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id       UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  monthly_amount   NUMERIC(10,2),
  payout_position  INTEGER,
  status           TEXT NOT NULL DEFAULT 'active',
  role             TEXT NOT NULL DEFAULT 'member',
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Contributions ─────────────────────────────────────────────
CREATE TABLE public.contributions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id    UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL,
  date          DATE NOT NULL,
  method        TEXT NOT NULL DEFAULT 'cash',
  status        TEXT NOT NULL DEFAULT 'confirmed',
  notes         TEXT,
  recorded_by   UUID NOT NULL REFERENCES public.profiles(id),
  recorded_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Meetings ──────────────────────────────────────────────────
CREATE TABLE public.meetings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id         UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  date               DATE NOT NULL,
  location           TEXT,
  attendees          UUID[] DEFAULT '{}',
  raw_notes          TEXT,
  formatted_minutes  TEXT,
  ai_summary         TEXT,
  created_by         UUID NOT NULL REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payouts ───────────────────────────────────────────────────
CREATE TABLE public.payouts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES public.stokvel_members(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'scheduled',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI Cache (monthly health reports) ─────────────────────────
CREATE TABLE public.ai_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  cache_key   TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stokvel_id, cache_key)
);

-- ── Announcements ─────────────────────────────────────────────
CREATE TABLE public.announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info',
  pinned      BOOLEAN DEFAULT false,
  expires_at  TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscriptions (PayFast billing) ───────────────────────────
CREATE TABLE public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stokvel_id      UUID REFERENCES public.stokvels(id) ON DELETE SET NULL,
  plan_id         TEXT NOT NULL DEFAULT 'free',
  status          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'active' | 'cancelled' | 'expired'
  pf_token        TEXT,
  pf_payment_id   TEXT,
  amount          NUMERIC(10,2),
  billing_date    DATE,
  next_billing    DATE,
  started_at      TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Payment History ───────────────────────────────────────────
CREATE TABLE public.payment_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  stokvel_id      UUID REFERENCES public.stokvels(id),
  pf_payment_id   TEXT NOT NULL,
  amount          NUMERIC(10,2),
  plan_id         TEXT,
  status          TEXT,  -- 'complete' | 'failed' | 'cancelled'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reminder Log (for Vercel cron) ────────────────────────────
CREATE TABLE public.reminder_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id  UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- 'YYYY-MM'
  sent_count  INTEGER DEFAULT 0,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stokvel_id, month)
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log     ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Stokvels: admin full access + member read
CREATE POLICY "stokvels_admin" ON public.stokvels
  FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "stokvels_member_read" ON public.stokvels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvel_members
      WHERE stokvel_id = stokvels.id AND user_id = auth.uid()
    )
  );

-- Members
CREATE POLICY "members_stokvel_admin" ON public.stokvel_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = stokvel_members.stokvel_id AND admin_id = auth.uid()
    )
  );

CREATE POLICY "members_read_same_stokvel" ON public.stokvel_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvel_members AS sm
      WHERE sm.stokvel_id = stokvel_members.stokvel_id AND sm.user_id = auth.uid()
    )
  );

-- Contributions
CREATE POLICY "contributions_admin" ON public.contributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = contributions.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Meetings
CREATE POLICY "meetings_admin" ON public.meetings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = meetings.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Payouts
CREATE POLICY "payouts_admin" ON public.payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = payouts.stokvel_id AND admin_id = auth.uid()
    )
  );

-- AI Cache
CREATE POLICY "ai_cache_admin" ON public.ai_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = ai_cache.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Announcements: admin manages, active members can read
CREATE POLICY "announcements_admin" ON public.announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = announcements.stokvel_id AND admin_id = auth.uid()
    )
  );

CREATE POLICY "announcements_member_read" ON public.announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvel_members
      WHERE stokvel_id = announcements.stokvel_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Subscriptions: user owns their own
CREATE POLICY "subscriptions_own" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Payment history: user reads their own
CREATE POLICY "payment_history_own" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- Audit log: admin reads their stokvel's log
CREATE POLICY "audit_log_admin" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = audit_log.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Reminder log: admin access
CREATE POLICY "reminder_log_admin" ON public.reminder_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = reminder_log.stokvel_id AND admin_id = auth.uid()
    )
  );

-- ── updated_at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER stokvels_updated_at
  BEFORE UPDATE ON public.stokvels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON public.stokvel_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create profile on auth signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Get user's active plan ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plan TEXT;
BEGIN
  SELECT plan_id INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
  RETURN COALESCE(v_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── View: profiles with plan info ─────────────────────────────
CREATE OR REPLACE VIEW public.profiles_with_plan AS
SELECT
  p.*,
  COALESCE(s.plan_id, 'free') AS plan_id,
  COALESCE(s.status,  'free') AS plan_status,
  s.next_billing,
  s.pf_token
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id;

-- ── View: per-member contribution summary ─────────────────────
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
LEFT JOIN public.contributions c ON c.member_id = sm.id
GROUP BY sm.id, sm.stokvel_id, sm.name, sm.email, sm.phone,
         sm.monthly_amount, sm.payout_position, sm.status;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_contributions_stokvel       ON public.contributions(stokvel_id);
CREATE INDEX idx_contributions_member        ON public.contributions(member_id);
CREATE INDEX idx_contributions_date          ON public.contributions(date);
CREATE INDEX idx_contributions_status        ON public.contributions(status);
CREATE INDEX idx_contributions_stokvel_date  ON public.contributions(stokvel_id, date DESC);
CREATE INDEX idx_members_stokvel             ON public.stokvel_members(stokvel_id);
CREATE INDEX idx_members_status              ON public.stokvel_members(status);
CREATE INDEX idx_meetings_stokvel            ON public.meetings(stokvel_id);
CREATE INDEX idx_payouts_stokvel             ON public.payouts(stokvel_id);
CREATE INDEX idx_payouts_member              ON public.payouts(member_id);
CREATE INDEX idx_announcements_stokvel       ON public.announcements(stokvel_id, created_at DESC);
CREATE INDEX idx_audit_log_stokvel           ON public.audit_log(stokvel_id);
CREATE INDEX idx_audit_log_created           ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor             ON public.audit_log(actor_id);
