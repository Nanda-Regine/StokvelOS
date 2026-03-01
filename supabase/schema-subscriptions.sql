-- ============================================================
-- StokvelOS — Schema Additions: Subscriptions & PayFast
-- Append this to your existing schema.sql or run separately
-- ============================================================

-- ── Subscriptions table ───────────────────────────────────────
CREATE TABLE public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stokvel_id      UUID REFERENCES public.stokvels(id) ON DELETE SET NULL,
  plan_id         TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'basic' | 'premium'
  status          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'active' | 'cancelled' | 'expired'
  pf_token        TEXT,            -- PayFast subscription token
  pf_payment_id   TEXT,            -- PayFast transaction ID
  amount          NUMERIC(10,2),
  billing_date    DATE,
  next_billing    DATE,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Payment history ───────────────────────────────────────────
CREATE TABLE public.payment_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  stokvel_id      UUID REFERENCES public.stokvels(id),
  pf_payment_id   TEXT NOT NULL,
  m_payment_id    TEXT,
  amount_gross    NUMERIC(10,2),
  amount_fee      NUMERIC(10,2),
  amount_net      NUMERIC(10,2),
  plan_id         TEXT,
  status          TEXT,            -- 'COMPLETE' | 'FAILED' | 'CANCELLED'
  item_name       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add subscription_status to stokvels for quick access
ALTER TABLE public.stokvels
  ADD COLUMN IF NOT EXISTS plan_id   TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'free';

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_own" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "payment_history_own" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- ── Trigger for updated_at ────────────────────────────────────
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Function: get subscription status for a user ─────────────
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

-- ── View: users with plan info ────────────────────────────────
CREATE OR REPLACE VIEW public.profiles_with_plan AS
SELECT
  p.*,
  COALESCE(s.plan_id, 'free')    AS plan_id,
  COALESCE(s.status, 'free')     AS plan_status,
  s.next_billing,
  s.pf_token
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id;
