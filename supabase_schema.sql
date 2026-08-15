-- ==========================================================
-- StudySync Supabase PostgreSQL Schema Migration
-- Run this SQL in your Supabase Dashboard -> SQL Editor
-- ==========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  study_goal TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'General Study',
  admin_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  daily_start_time TEXT DEFAULT '19:00',
  daily_end_time TEXT DEFAULT '23:00',
  target_daily_hours NUMERIC DEFAULT 4,
  schedule JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campaign Memberships Table
CREATE TABLE IF NOT EXISTS public.memberships (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'member', -- 'admin' | 'member'
  status TEXT DEFAULT 'pending', -- 'approved' | 'pending' | 'rejected'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

-- 4. Study Blocks Table
CREATE TABLE IF NOT EXISTS public.study_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar_url TEXT DEFAULT '',
  campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active', -- 'active' | 'idle'
  subject_note TEXT DEFAULT 'Focus Study',
  snapshot_url TEXT
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  campaign_id TEXT DEFAULT 'general',
  sender_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar_url TEXT DEFAULT '',
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT DEFAULT 'general', -- 'general' | 'announcement' | 'dm'
  recipient_id TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT
);

-- 6. Active Call Sessions Table
CREATE TABLE IF NOT EXISTS public.active_calls (
  campaign_id TEXT PRIMARY KEY,
  session_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create helpful query indexes
CREATE INDEX IF NOT EXISTS idx_memberships_campaign ON public.memberships(campaign_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_user ON public.study_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_campaign ON public.study_blocks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_study_blocks_time ON public.study_blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON public.messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_time ON public.messages(timestamp);

-- Enable Row Level Security (RLS) & allow backend service access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- Allow full access for backend service / anon API calls
CREATE POLICY "Allow all operations for service backend" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service backend" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service backend" ON public.memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service backend" ON public.study_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service backend" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for service backend" ON public.active_calls FOR ALL USING (true) WITH CHECK (true);
