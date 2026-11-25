-- ============================================================================
-- 005_restaurant_orders.sql
-- Restoran Salonu, Otomatik Garson NPC ('delivering' durumu), zorluk bazlı
-- teslim süreleri, sunucu taraflı cooldown/masa limiti, clock sync ve paket satış.
-- ÖNEMLİ: Müşteri ve Garson koordinatları ASLA Postgres'e yazılmaz.
-- ============================================================================

-- 1. home_inventory: 'cooked' aşaması (hazır tabaklar) desteği
ALTER TABLE public.home_inventory
  DROP CONSTRAINT IF EXISTS home_inventory_stage_check;

ALTER TABLE public.home_inventory
  ADD CONSTRAINT home_inventory_stage_check
  CHECK (stage IN ('raw', 'prepped', 'cooked'));

-- 2. home_state: Restoran açık/kapalı (varsayılan FALSE), servis sayacı, seri ve cooldown
ALTER TABLE public.home_state
  ADD COLUMN IF NOT EXISTS restaurant_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS served_orders_count integer NOT NULL DEFAULT 0 CHECK (served_orders_count >= 0),
  ADD COLUMN IF NOT EXISTS service_streak integer NOT NULL DEFAULT 0 CHECK (service_streak >= 0),
  ADD COLUMN IF NOT EXISTS last_order_spawned_at timestamptz;

-- 3. restaurant_orders tablosu
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id text NOT NULL CHECK (table_id IN ('table_1', 'table_2', 'table_3')),
  recipe_id text NOT NULL REFERENCES public.recipe_progress(recipe_id),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  customer_name text NOT NULL,
  customer_avatar text NOT NULL CHECK (customer_avatar IN ('cust_fox', 'cust_bunny', 'cust_bear')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'delivering', 'served', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  served_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  tip_coins integer NOT NULL DEFAULT 0 CHECK (tip_coins >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Aynı masada eşzamanlı birden fazla aktif ('waiting' veya 'delivering') sipariş oluşmasını engelle
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_order_per_table
  ON public.restaurant_orders (table_id)
  WHERE status IN ('waiting', 'delivering');

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_active
  ON public.restaurant_orders (status, expires_at);

ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_restaurant_orders" ON public.restaurant_orders;
CREATE POLICY "authenticated_read_restaurant_orders" ON public.restaurant_orders
  FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_orders;
  END IF;
END $$;

-- 4. Sunucu saati (clock skew telafisi için)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now();
$$;

-- 5. Restoran servisini manuel aç / kapat
CREATE OR REPLACE FUNCTION public.set_restaurant_open(
  p_open boolean
)
RETURNS TABLE(ok boolean, restaurant_open boolean, server_now timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, false, now();
    RETURN;
  END IF;

  UPDATE public.home_state
  SET restaurant_open = COALESCE(p_open, false),
      last_order_spawned_at = CASE WHEN COALESCE(p_open, false) THEN NULL ELSE last_order_spawned_at END,
      updated_at = now()
  WHERE id = 'home';

  RETURN QUERY SELECT true, COALESCE(p_open, false), now();
END;
$$;

-- 6. Ocak pişirme RPC güncellemesi: artık pişen yemeği 'cooked' stoğuna ekler
CREATE OR REPLACE FUNCTION public.complete_cook(
  p_recipe_id text,
  p_required_items jsonb,
  p_reward_coins integer
)
RETURNS TABLE(ok boolean, new_coins integer, cook_count integer, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_item jsonb;
  v_item_id text;
  v_need integer;
  v_coins integer;
  v_count integer;
  v_cooked_id text := 'dish_' || p_recipe_id;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'UNAUTHENTICATED';
    RETURN;
  END IF;

  IF p_recipe_id NOT IN ('menemen', 'mantarli_makarna', 'pankek') THEN
    RETURN QUERY SELECT false, 0, 0, 'INVALID_RECIPE';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kitchen_stations
    WHERE id = 'stove'
      AND locked_by IS NOT NULL
      AND locked_by <> v_profile
      AND lock_expires_at >= now()
  ) THEN
    RETURN QUERY SELECT false, 0, 0, 'STATION_LOCKED';
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_required_items)
  LOOP
    v_item_id := v_item->>'itemId';
    v_need := (v_item->>'qty')::integer;

    UPDATE public.home_inventory
    SET quantity = quantity - v_need,
        updated_at = now()
    WHERE item_id = v_item_id AND quantity >= v_need;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MISSING_INGREDIENT:%', v_item_id;
    END IF;
  END LOOP;

  -- Pişen yemeği servis/paket için ortak 'cooked' stoğuna ekle
  INSERT INTO public.home_inventory (item_id, stage, quantity, updated_at)
  VALUES (v_cooked_id, 'cooked', 1, now())
  ON CONFLICT (item_id) DO UPDATE
    SET stage = 'cooked',
        quantity = public.home_inventory.quantity + 1,
        updated_at = now();

  SELECT coins INTO v_coins FROM public.home_state WHERE id = 'home';

  UPDATE public.recipe_progress
  SET in_game_cook_count = in_game_cook_count + 1,
      updated_at = now()
  WHERE recipe_id = p_recipe_id
  RETURNING in_game_cook_count INTO v_count;

  UPDATE public.kitchen_stations
  SET locked_by = NULL,
      lock_expires_at = NULL,
      status = 'ready',
      active_recipe_id = p_recipe_id,
      station_payload = jsonb_build_object('lastCooked', p_recipe_id, 'cookedItemId', v_cooked_id, 'by', v_profile, 'at', now()),
      updated_at = now()
  WHERE id = 'stove';

  RETURN QUERY SELECT true, COALESCE(v_coins, 0), COALESCE(v_count, 0), NULL::text;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'MISSING_INGREDIENT:%' THEN
      RETURN QUERY SELECT false, 0, 0, SQLERRM;
    ELSE
      RAISE;
    END IF;
END;
$$;

-- 7. Destek paketi güncellemesi: hazır tabak varken de kilitlenme sayılmaz
CREATE OR REPLACE FUNCTION public.claim_pantry_support()
RETURNS TABLE(ok boolean, new_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_coins integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.home_inventory
    WHERE stage = 'cooked' AND quantity > 0
  ) THEN
    SELECT coins INTO v_coins FROM public.home_state WHERE id = 'home';
    RETURN QUERY SELECT false, COALESCE(v_coins, 0);
    RETURN;
  END IF;

  UPDATE public.home_state
  SET coins = coins + 50,
      updated_at = now()
  WHERE id = 'home' AND coins < 30
  RETURNING coins INTO v_coins;

  IF NOT FOUND THEN
    SELECT coins INTO v_coins FROM public.home_state WHERE id = 'home';
    RETURN QUERY SELECT false, COALESCE(v_coins, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_coins;
END;
$$;

-- 8. Fazla pişen tabakları paket satışla nakde çevirme
CREATE OR REPLACE FUNCTION public.sell_cooked_dish(
  p_cooked_item_id text,
  p_qty integer,
  p_unit_price integer
)
RETURNS TABLE(ok boolean, new_coins integer, new_quantity integer, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_qty integer;
  v_coins integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'UNAUTHENTICATED';
    RETURN;
  END IF;

  IF p_qty <= 0 OR p_unit_price <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'INVALID_ARGS';
    RETURN;
  END IF;

  UPDATE public.home_inventory
  SET quantity = quantity - p_qty,
      updated_at = now()
  WHERE item_id = p_cooked_item_id
    AND stage = 'cooked'
    AND quantity >= p_qty
  RETURNING quantity INTO v_qty;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'MISSING_COOKED_DISH';
    RETURN;
  END IF;

  UPDATE public.home_state
  SET coins = coins + (p_qty * p_unit_price),
      updated_at = now()
  WHERE id = 'home'
  RETURNING coins INTO v_coins;

  RETURN QUERY SELECT true, COALESCE(v_coins, 0), COALESCE(v_qty, 0), NULL::text;
END;
$$;

-- 9. Süresi dolan siparişleri temizleme + eski 'delivering' siparişleri sonlandırma (Cozy Mod: coin cezası yok)
CREATE OR REPLACE FUNCTION public.expire_restaurant_orders()
RETURNS TABLE(expired_count integer, finalized_count integer, service_streak integer, server_now timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_expired integer := 0;
  v_finalized integer := 0;
  v_streak integer := 0;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, now();
    RETURN;
  END IF;

  -- Yolda kalan / sayfa yenilemesi sonrası tamamlanmayan teslimatları güvenle 'served' yap
  UPDATE public.restaurant_orders
  SET status = 'served',
      updated_at = now()
  WHERE status = 'delivering'
    AND delivered_at IS NOT NULL
    AND delivered_at < now() - interval '11 seconds';
  GET DIAGNOSTICS v_finalized = ROW_COUNT;

  -- Süresi dolan 'waiting' siparişleri 'expired' yap ('delivering' ASLA zaman aşımına uğramaz!)
  UPDATE public.restaurant_orders
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'waiting'
    AND expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  IF v_expired > 0 THEN
    UPDATE public.home_state
    SET service_streak = 0,
        updated_at = now()
    WHERE id = 'home'
    RETURNING public.home_state.service_streak INTO v_streak;
  ELSE
    SELECT hs.service_streak INTO v_streak FROM public.home_state hs WHERE hs.id = 'home';
  END IF;

  RETURN QUERY SELECT v_expired, v_finalized, COALESCE(v_streak, 0), now();
END;
$$;

-- 10. Atomik Müşteri Siparişi Oluşturma (sunucu taraflı cooldown + aktif masa limiti + unique index koruması)
CREATE OR REPLACE FUNCTION public.spawn_restaurant_order(
  p_table_id text,
  p_recipe_id text,
  p_difficulty text,
  p_customer_name text,
  p_customer_avatar text,
  p_duration_seconds integer,
  p_max_active_orders integer DEFAULT 2
)
RETURNS TABLE(ok boolean, order_id uuid, server_now timestamptz, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_home public.home_state%ROWTYPE;
  v_active_count integer;
  v_cap integer := GREATEST(1, LEAST(COALESCE(p_max_active_orders, 2), 3));
  v_duration integer := GREATEST(30, LEAST(COALESCE(p_duration_seconds, 90), 300));
  v_new_id uuid;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, now(), 'UNAUTHENTICATED';
    RETURN;
  END IF;

  -- Eşzamanlı spawn yarışlarını engellemek için home_state satırını kilitle
  SELECT * INTO v_home FROM public.home_state WHERE id = 'home' FOR UPDATE;
  IF NOT FOUND OR NOT v_home.restaurant_open THEN
    RETURN QUERY SELECT false, NULL::uuid, now(), 'RESTAURANT_CLOSED';
    RETURN;
  END IF;

  -- Önce eski teslimatları ve süresi dolan bekleyenleri temizle
  PERFORM public.expire_restaurant_orders();

  -- Sunucu taraflı 8 saniye cooldown koruması
  IF v_home.last_order_spawned_at IS NOT NULL
     AND v_home.last_order_spawned_at > now() - interval '8 seconds' THEN
    RETURN QUERY SELECT false, NULL::uuid, now(), 'COOLDOWN';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.restaurant_orders
  WHERE status IN ('waiting', 'delivering');

  IF v_active_count >= v_cap THEN
    RETURN QUERY SELECT false, NULL::uuid, now(), 'TABLE_LIMIT';
    RETURN;
  END IF;

  INSERT INTO public.restaurant_orders (
    table_id,
    recipe_id,
    difficulty,
    customer_name,
    customer_avatar,
    status,
    created_at,
    expires_at,
    updated_at
  ) VALUES (
    p_table_id,
    p_recipe_id,
    p_difficulty,
    left(trim(COALESCE(p_customer_name, 'Misafir')), 28),
    p_customer_avatar,
    'waiting',
    now(),
    now() + make_interval(secs => v_duration),
    now()
  )
  RETURNING id INTO v_new_id;

  UPDATE public.home_state
  SET last_order_spawned_at = now(),
      updated_at = now()
  WHERE id = 'home';

  RETURN QUERY SELECT true, v_new_id, now(), NULL::text;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, NULL::uuid, now(), 'TABLE_OCCUPIED';
END;
$$;

-- 11. Garsona Teslim Et / Hazır Gönder (Süreyi anında durdurur, coin+bahşişi kilitler, 'delivering' yapar)
CREATE OR REPLACE FUNCTION public.serve_restaurant_order(
  p_order_id uuid,
  p_base_reward integer,
  p_tip_rate numeric
)
RETURNS TABLE(
  ok boolean,
  reward_coins integer,
  tip_coins integer,
  new_coins integer,
  service_streak integer,
  server_now timestamptz,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_order public.restaurant_orders%ROWTYPE;
  v_cooked_id text;
  v_total numeric;
  v_rem numeric;
  v_ratio numeric;
  v_reward integer;
  v_tip integer;
  v_coins integer;
  v_streak integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, now(), 'UNAUTHENTICATED';
    RETURN;
  END IF;

  SELECT * INTO v_order
  FROM public.restaurant_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, now(), 'ORDER_NOT_FOUND';
    RETURN;
  END IF;

  IF v_order.status <> 'waiting' THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, now(), 'ORDER_ALREADY_HANDLED';
    RETURN;
  END IF;

  IF v_order.expires_at <= now() THEN
    UPDATE public.restaurant_orders
    SET status = 'expired', updated_at = now()
    WHERE id = p_order_id;
    UPDATE public.home_state SET service_streak = 0, updated_at = now() WHERE id = 'home';
    RETURN QUERY SELECT false, 0, 0, 0, 0, now(), 'ORDER_EXPIRED';
    RETURN;
  END IF;

  v_cooked_id := 'dish_' || v_order.recipe_id;

  UPDATE public.home_inventory
  SET quantity = quantity - 1,
      updated_at = now()
  WHERE item_id = v_cooked_id
    AND stage = 'cooked'
    AND quantity >= 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, now(), 'MISSING_COOKED_DISH';
    RETURN;
  END IF;

  -- Sunucu saatine göre sabır yüzdesi ve bahşiş hesabı
  v_total := GREATEST(1.0, EXTRACT(EPOCH FROM (v_order.expires_at - v_order.created_at)));
  v_rem := GREATEST(0.0, EXTRACT(EPOCH FROM (v_order.expires_at - now())));
  v_ratio := LEAST(1.0, v_rem / v_total);

  IF v_ratio > 0.5 THEN
    v_reward := GREATEST(0, p_base_reward);
    v_tip := ROUND(GREATEST(0, p_base_reward) * GREATEST(0, LEAST(p_tip_rate, 0.5)))::integer;
  ELSIF v_ratio >= 0.2 THEN
    v_reward := GREATEST(0, p_base_reward);
    v_tip := 0;
  ELSE
    v_reward := ROUND(GREATEST(0, p_base_reward) * 0.85)::integer;
    v_tip := 0;
  END IF;

  -- Süreyi anında dondur ve Garson NPC teslimatına geçir ('delivering')
  UPDATE public.restaurant_orders
  SET status = 'delivering',
      delivered_at = now(),
      served_by = v_profile,
      reward_coins = v_reward,
      tip_coins = v_tip,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.home_state
  SET coins = coins + v_reward + v_tip,
      served_orders_count = served_orders_count + 1,
      service_streak = service_streak + 1,
      updated_at = now()
  WHERE id = 'home'
  RETURNING public.home_state.coins, public.home_state.service_streak
  INTO v_coins, v_streak;

  RETURN QUERY SELECT true, v_reward, v_tip, COALESCE(v_coins, 0), COALESCE(v_streak, 0), now(), NULL::text;
END;
$$;

-- 12. Garson masaya bırakıp müşteri ayrıldıktan sonra siparişi 'served' olarak kapatma
CREATE OR REPLACE FUNCTION public.complete_restaurant_order(
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.restaurant_orders
  SET status = 'served',
      updated_at = now()
  WHERE id = p_order_id
    AND status = 'delivering';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_restaurant_open(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_cooked_dish(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_restaurant_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spawn_restaurant_order(text, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.serve_restaurant_order(uuid, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_restaurant_order(uuid) TO authenticated;
