-- ============================================================================
-- 003_seed_home.sql
-- Sabit 2 profil, başlangıç cüzdanı, 3 istasyon, 3 tarif ve başlangıç buzdolabı stoğu.
-- NOT: Supabase Dashboard -> Authentication -> Users üzerinden:
--   1) p1@home.local  (Şifre: <ORTAK_PIN>_kitchen_home_v1)
--   2) p2@home.local  (Şifre: <ORTAK_PIN>_kitchen_home_v1)
-- kullanıcılarını oluşturduktan sonra aşağıdaki auth_uid eşlemesini çalıştırın.
-- ============================================================================

INSERT INTO public.profiles (id, display_name, avatar_color)
VALUES
  ('p1', 'Şef 1', '#e07a5f'),
  ('p2', 'Şef 2', '#3d9970')
ON CONFLICT (id) DO NOTHING;

-- Eğer auth.users içinde p1@home.local ve p2@home.local mevcutsa otomatik eşle
UPDATE public.profiles p
SET auth_uid = u.id
FROM auth.users u
WHERE (p.id = 'p1' AND u.email = 'p1@home.local')
   OR (p.id = 'p2' AND u.email = 'p2@home.local');

INSERT INTO public.home_state (id, coins)
VALUES ('home', 120)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kitchen_stations (id, status)
VALUES
  ('fridge', 'idle'),
  ('cutting_board', 'idle'),
  ('stove', 'idle')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recipe_progress (recipe_id)
VALUES
  ('menemen'),
  ('mantarli_makarna'),
  ('pankek')
ON CONFLICT (recipe_id) DO NOTHING;

-- 1 Menemen hazırlayabilecek sıcak başlangıç stoğu
INSERT INTO public.home_inventory (item_id, stage, quantity)
VALUES
  ('domates', 'raw', 2),
  ('biber', 'raw', 2),
  ('yumurta', 'raw', 3),
  ('mantar', 'raw', 1),
  ('makarna', 'raw', 1),
  ('krema', 'raw', 1),
  ('cilek', 'raw', 1),
  ('un', 'raw', 1),
  ('sut', 'raw', 1)
ON CONFLICT (item_id) DO NOTHING;
