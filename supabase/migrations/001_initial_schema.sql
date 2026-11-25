-- ============================================================================
-- 001_initial_schema.sql
-- Tek kalıcı ev ("home"), sabit 2 profil (p1, p2), 3 istasyon, ortak stok/cüzdan
-- ve tarif ilerlemesi.
-- ÖNEMLİ: Oyuncu koordinatları/animasyonu ASLA Postgres'e yazılmaz (sadece Broadcast).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY CHECK (id IN ('p1', 'p2')),
  auth_uid uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  avatar_color text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_state (
  id text PRIMARY KEY DEFAULT 'home' CHECK (id = 'home'),
  coins integer NOT NULL DEFAULT 120 CHECK (coins >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_inventory (
  item_id text PRIMARY KEY,
  stage text NOT NULL CHECK (stage IN ('raw', 'prepped')),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kitchen_stations (
  id text PRIMARY KEY CHECK (id IN ('fridge', 'cutting_board', 'stove')),
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'in_use', 'ready')),
  active_recipe_id text,
  station_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  lock_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_progress (
  recipe_id text PRIMARY KEY CHECK (recipe_id IN ('menemen', 'mantarli_makarna', 'pankek')),
  in_game_cook_count integer NOT NULL DEFAULT 0 CHECK (in_game_cook_count >= 0),
  irl_cooked_count integer NOT NULL DEFAULT 0 CHECK (irl_cooked_count >= 0),
  irl_confirmed_p1 boolean NOT NULL DEFAULT false,
  irl_confirmed_p2 boolean NOT NULL DEFAULT false,
  irl_last_cooked_at timestamptz,
  irl_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Row Level Security (RLS)
-- Sadece oturum açmış (ortak PIN ile giriş yapmış 2 sabit kullanıcı) erişebilir.
-- Yazma işlemleri güvenlik ve yarış durumu koruması için atomik RPC'lerle yapılır.
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;
CREATE POLICY "authenticated_read_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_home_state" ON public.home_state;
CREATE POLICY "authenticated_read_home_state" ON public.home_state
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_home_inventory" ON public.home_inventory;
CREATE POLICY "authenticated_read_home_inventory" ON public.home_inventory
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_kitchen_stations" ON public.kitchen_stations;
CREATE POLICY "authenticated_read_kitchen_stations" ON public.kitchen_stations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_recipe_progress" ON public.recipe_progress;
CREATE POLICY "authenticated_read_recipe_progress" ON public.recipe_progress
  FOR SELECT TO authenticated USING (true);

-- Realtime Postgres Changes yayını
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'home_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.home_state;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'home_inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.home_inventory;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'kitchen_stations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_stations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'recipe_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_progress;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
