# Supabase Kurulum Rehberi (2 Dakika)

Bu proje varsayılan olarak **Yerel Ev Modu** (PIN: `1234`, aynı tarayıcıda çift sekme senkronizasyonu) ile anında çalışır. İki farklı telefon (iPhone 17 Pro & Samsung S23) arasında gerçek zamanlı bulut senkronizasyonu için aşağıdaki 3 adımı uygulayın:

## 1. SQL Migration'ları Çalıştırın
Supabase Dashboard → **SQL Editor** bölümünde sırasıyla şu 3 dosyayı çalıştırın:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rpc_functions.sql`
3. `supabase/migrations/003_seed_home.sql`

## 2. Sabit 2 Profil Kullanıcısını Oluşturun
Supabase Dashboard → **Authentication → Users → Add user (Auto Confirm User açık)** ile iki kullanıcı oluşturun (ikisi de aynı ortak PIN'i paylaşır, örneğin ortak PIN `4829` ise şifre `4829_kitchen_home_v1`):
- `p1@home.local` → Şifre: `<ORTAK_PIN>_kitchen_home_v1`
- `p2@home.local` → Şifre: `<ORTAK_PIN>_kitchen_home_v1`

Ardından SQL Editor'de kullanıcı eşlemesini bir kez çalıştırın:
```sql
UPDATE public.profiles p
SET auth_uid = u.id
FROM auth.users u
WHERE (p.id = 'p1' AND u.email = 'p1@home.local')
   OR (p.id = 'p2' AND u.email = 'p2@home.local');
```

## 3. Uygulamaya Bağlayın
İki yoldan birini seçin:
- **Kalıcı (Önerilen):** GitHub Repo → **Settings → Secrets and variables → Actions** içine `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ekleyip workflow'u yeniden çalıştırın.
- **Hızlı (Anında):** Uygulama giriş ekranındaki sağ üst ⚙️ (**Supabase Bağlantı Ayarları**) butonuna dokunup Project URL ve public Anon Key'i girin.
