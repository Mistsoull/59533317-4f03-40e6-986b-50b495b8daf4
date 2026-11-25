-- ============================================================================
-- 004_profile_character.sql
-- Kullanıcının girişte kendi adını ve karakterini (cat, dog, bubu, dudu) seçmesi.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS character_id text NOT NULL DEFAULT 'bubu'
  CHECK (character_id IN ('cat', 'dog', 'bubu', 'dudu'));

UPDATE public.profiles SET character_id = 'bubu' WHERE id = 'p1' AND character_id IS NULL;
UPDATE public.profiles SET character_id = 'dudu' WHERE id = 'p2' AND character_id = 'bubu';

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_display_name text,
  p_character_id text
)
RETURNS TABLE(id text, display_name text, avatar_color text, character_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text := public.current_profile_id();
  v_name text := left(trim(COALESCE(p_display_name, '')), 20);
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated profile';
  END IF;

  IF p_character_id NOT IN ('cat', 'dog', 'bubu', 'dudu') THEN
    RAISE EXCEPTION 'Invalid character_id';
  END IF;

  IF length(v_name) < 1 THEN
    v_name := CASE WHEN v_profile = 'p1' THEN 'Şef 1' ELSE 'Şef 2' END;
  END IF;

  RETURN QUERY
  UPDATE public.profiles p
  SET display_name = v_name,
      character_id = p_character_id,
      updated_at = now()
  WHERE p.id = v_profile
  RETURNING p.id, p.display_name, p.avatar_color, p.character_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;
