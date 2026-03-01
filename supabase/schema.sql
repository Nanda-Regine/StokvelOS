-- ============================================================
-- StokvelOS — Supabase Database Schema
-- Run this in your Supabase SQL Editor
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

-- ── AI Cache (monthly health reports) ────────────────────────
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
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
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

-- Profiles: users can read/write their own
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Stokvels: admin can manage, members can read
CREATE POLICY "stokvels_admin" ON public.stokvels
  FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "stokvels_member_read" ON public.stokvels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stokvel_members
      WHERE stokvel_id = stokvels.id AND user_id = auth.uid()
    )
  );

-- Members: admin can manage, members can read own stokvel
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

-- Contributions: admin full access, members read own
CREATE POLICY "contributions_admin" ON public.contributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = contributions.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Meetings: admin full access
CREATE POLICY "meetings_admin" ON public.meetings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = meetings.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Payouts: admin full access
CREATE POLICY "payouts_admin" ON public.payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = payouts.stokvel_id AND admin_id = auth.uid()
    )
  );

-- AI Cache: admin access
CREATE POLICY "ai_cache_admin" ON public.ai_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = ai_cache.stokvel_id AND admin_id = auth.uid()
    )
  );

-- Announcements: admin manages, members read
CREATE POLICY "announcements_admin" ON public.announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stokvels
      WHERE id = announcements.stokvel_id AND admin_id = auth.uid()
    )
  );

-- ── Triggers: updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stokvels_updated_at     BEFORE UPDATE ON public.stokvels     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER members_updated_at      BEFORE UPDATE ON public.stokvel_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER meetings_updated_at     BEFORE UPDATE ON public.meetings     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Function: auto-create profile on signup ───────────────────
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

-- ── Indexes for performance ───────────────────────────────────
CREATE INDEX idx_contributions_stokvel  ON public.contributions(stokvel_id);
CREATE INDEX idx_contributions_member   ON public.contributions(member_id);
CREATE INDEX idx_contributions_date     ON public.contributions(date);
CREATE INDEX idx_members_stokvel        ON public.stokvel_members(stokvel_id);
CREATE INDEX idx_meetings_stokvel       ON public.meetings(stokvel_id);
CREATE INDEX idx_payouts_stokvel        ON public.payouts(stokvel_id);
