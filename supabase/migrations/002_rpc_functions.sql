-- ============================================================================
-- 002_rpc_functions.sql
-- Yarış durumunu (race condition) önleyen atomik Postgres RPC fonksiyonları.
-- ============================================================================

-- Yardımcı: aktif JWT kullanıcısının profil kimliğini ('p1' | 'p2') çözer
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_uid = auth.uid() LIMIT 1;
$$;

-- 1. Atomik İstasyon Kilidi Alma (TTL destekli)
CREATE OR REPLACE FUNCTION public.acquire_station_lock(
  p_station_id text,
  p_ttl_seconds integer DEFAULT 25
)
RETURNS TABLE(acquired boolean, locked_by text, lock_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_row public.kitchen_stations%ROWTYPE;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated profile';
  END IF;

  UPDATE public.kitchen_stations ks
  SET locked_by = v_profile,
      lock_expires_at = now() + make_interval(secs => GREATEST(10, LEAST(p_ttl_seconds, 60))),
      status = CASE WHEN ks.status = 'idle' THEN 'in_use' ELSE ks.status END,
      updated_at = now()
  WHERE ks.id = p_station_id
    AND (ks.locked_by IS NULL OR ks.locked_by = v_profile OR ks.lock_expires_at < now())
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_row.locked_by, v_row.lock_expires_at;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.kitchen_stations WHERE id = p_station_id;
  RETURN QUERY SELECT false, v_row.locked_by, v_row.lock_expires_at;
END;
$$;

-- 2. Kilit Süresini Uzatma (Heartbeat)
CREATE OR REPLACE FUNCTION public.heartbeat_station_lock(
  p_station_id text,
  p_ttl_seconds integer DEFAULT 25
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

  UPDATE public.kitchen_stations
  SET lock_expires_at = now() + make_interval(secs => GREATEST(10, LEAST(p_ttl_seconds, 60))),
      updated_at = now()
  WHERE id = p_station_id
    AND locked_by = v_profile;

  RETURN FOUND;
END;
$$;

-- 3. İstasyon Kilidini Bırakma
CREATE OR REPLACE FUNCTION public.release_station_lock(
  p_station_id text
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

  UPDATE public.kitchen_stations
  SET locked_by = NULL,
      lock_expires_at = NULL,
      status = CASE WHEN status = 'in_use' THEN 'idle' ELSE status END,
      active_recipe_id = NULL,
      updated_at = now()
  WHERE id = p_station_id
    AND (locked_by = v_profile OR lock_expires_at < now());

  RETURN FOUND;
END;
$$;

-- 4. Marketten Atomik Malzeme Satın Alma
CREATE OR REPLACE FUNCTION public.buy_ingredient(
  p_item_id text,
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
  v_total integer;
  v_coins integer;
  v_qty integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'UNAUTHENTICATED';
    RETURN;
  END IF;

  IF p_qty <= 0 OR p_unit_price < 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'INVALID_ARGS';
    RETURN;
  END IF;

  v_total := p_qty * p_unit_price;

  UPDATE public.home_state
  SET coins = coins - v_total,
      updated_at = now()
  WHERE id = 'home' AND coins >= v_total
  RETURNING coins INTO v_coins;

  IF NOT FOUND THEN
    SELECT coins INTO v_coins FROM public.home_state WHERE id = 'home';
    RETURN QUERY SELECT false, COALESCE(v_coins, 0), 0, 'INSUFFICIENT_COINS';
    RETURN;
  END IF;

  INSERT INTO public.home_inventory (item_id, stage, quantity, updated_at)
  VALUES (p_item_id, 'raw', p_qty, now())
  ON CONFLICT (item_id) DO UPDATE
    SET quantity = public.home_inventory.quantity + EXCLUDED.quantity,
        updated_at = now()
  RETURNING quantity INTO v_qty;

  RETURN QUERY SELECT true, v_coins, v_qty, NULL::text;
END;
$$;

-- 5. Ekonomik Kilitlenme Koruması (Acil Mutfak Destek Paketi)
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

-- 6. Kesme Tahtasında Atomik Hazırlık Tamamlama
CREATE OR REPLACE FUNCTION public.complete_prep(
  p_raw_item_id text,
  p_prepped_item_id text
)
RETURNS TABLE(ok boolean, prepped_qty integer, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_qty integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 'UNAUTHENTICATED';
    RETURN;
  END IF;

  -- Kilidi doğrula (boşsa veya kullanıcıdaysa devam)
  IF EXISTS (
    SELECT 1 FROM public.kitchen_stations
    WHERE id = 'cutting_board'
      AND locked_by IS NOT NULL
      AND locked_by <> v_profile
      AND lock_expires_at >= now()
  ) THEN
    RETURN QUERY SELECT false, 0, 'STATION_LOCKED';
    RETURN;
  END IF;

  UPDATE public.home_inventory
  SET quantity = quantity - 1,
      updated_at = now()
  WHERE item_id = p_raw_item_id AND stage = 'raw' AND quantity >= 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'MISSING_RAW_ITEM';
    RETURN;
  END IF;

  INSERT INTO public.home_inventory (item_id, stage, quantity, updated_at)
  VALUES (p_prepped_item_id, 'prepped', 1, now())
  ON CONFLICT (item_id) DO UPDATE
    SET quantity = public.home_inventory.quantity + 1,
        updated_at = now()
  RETURNING quantity INTO v_qty;

  UPDATE public.kitchen_stations
  SET locked_by = NULL,
      lock_expires_at = NULL,
      status = 'idle',
      station_payload = jsonb_build_object('lastPrepped', p_prepped_item_id, 'by', v_profile, 'at', now()),
      updated_at = now()
  WHERE id = 'cutting_board';

  RETURN QUERY SELECT true, v_qty, NULL::text;
END;
$$;

-- 7. Ocakta Atomik Pişirme Tamamlama
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
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'UNAUTHENTICATED';
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

  -- Tüm gerekli malzemeleri atomik olarak kontrol et ve düş
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

  UPDATE public.home_state
  SET coins = coins + GREATEST(0, p_reward_coins),
      updated_at = now()
  WHERE id = 'home'
  RETURNING coins INTO v_coins;

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
      station_payload = jsonb_build_object('lastCooked', p_recipe_id, 'by', v_profile, 'at', now()),
      updated_at = now()
  WHERE id = 'stove';

  RETURN QUERY SELECT true, v_coins, v_count, NULL::text;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'MISSING_INGREDIENT:%' THEN
      RETURN QUERY SELECT false, 0, 0, SQLERRM;
    ELSE
      RAISE;
    END IF;
END;
$$;

-- 8. Tarif Defteri: "Gerçekte Yaptık!" Onayı (Tek Kişi & Çift Onay Bonuslu)
CREATE OR REPLACE FUNCTION public.confirm_recipe_irl(
  p_recipe_id text,
  p_note text DEFAULT NULL,
  p_reset_cycle boolean DEFAULT false
)
RETURNS TABLE(ok boolean, new_coins integer, both_confirmed boolean, irl_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_row public.recipe_progress%ROWTYPE;
  v_bonus integer := 0;
  v_coins integer;
BEGIN
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 0, false, 0;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.recipe_progress WHERE recipe_id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, false, 0;
    RETURN;
  END IF;

  IF p_reset_cycle THEN
    -- İki kişi zaten onaylamışken "Tekrar Yaptık" akışı
    v_row.irl_confirmed_p1 := (v_profile = 'p1');
    v_row.irl_confirmed_p2 := (v_profile = 'p2');
    v_row.irl_cooked_count := v_row.irl_cooked_count + 1;
    v_bonus := 30;
  ELSE
    IF v_profile = 'p1' AND NOT v_row.irl_confirmed_p1 THEN
      v_row.irl_confirmed_p1 := true;
      IF NOT v_row.irl_confirmed_p2 THEN
        v_row.irl_cooked_count := v_row.irl_cooked_count + 1;
        v_bonus := 30;
      ELSE
        v_bonus := 50; -- Çift onayı bonusu!
      END IF;
    ELSIF v_profile = 'p2' AND NOT v_row.irl_confirmed_p2 THEN
      v_row.irl_confirmed_p2 := true;
      IF NOT v_row.irl_confirmed_p1 THEN
        v_row.irl_cooked_count := v_row.irl_cooked_count + 1;
        v_bonus := 30;
      ELSE
        v_bonus := 50; -- Çift onayı bonusu!
      END IF;
    END IF;
  END IF;

  UPDATE public.recipe_progress
  SET irl_cooked_count = v_row.irl_cooked_count,
      irl_confirmed_p1 = v_row.irl_confirmed_p1,
      irl_confirmed_p2 = v_row.irl_confirmed_p2,
      irl_last_cooked_at = now(),
      irl_note = COALESCE(NULLIF(trim(p_note), ''), irl_note),
      updated_at = now()
  WHERE recipe_id = p_recipe_id;

  UPDATE public.home_state
  SET coins = coins + v_bonus,
      updated_at = now()
  WHERE id = 'home'
  RETURNING coins INTO v_coins;

  RETURN QUERY SELECT true, v_coins, (v_row.irl_confirmed_p1 AND v_row.irl_confirmed_p2), v_row.irl_cooked_count;
END;
$$;

-- Yetkilendirme: sadece oturum açmış kullanıcılar RPC çağırabilir
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_station_lock(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_station_lock(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_station_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_ingredient(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pantry_support() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_prep(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cook(text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_recipe_irl(text, text, boolean) TO authenticated;
