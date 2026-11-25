---
trigger: always_on
---

# Mutfak Oyunu (2 Kişilik İzometrik 3D Web/PWA) — Zorunlu Proje Kuralları

Bu kurallar proje boyunca bağlayıcıdır. Hiçbir fazda kullanıcı onayı olmadan esnetilemez.

## 1. Hedef Platform, PWA ve Mobil Safari/Chrome Zorunlulukları
- **Yalnızca Web/PWA:** Native derleme (Capacitor, Cordova, React Native, Expo vb.) ekleme.
- **Hedef Cihazlar:** iPhone 17 Pro (iOS Safari PWA) ve Samsung Galaxy S23 (Android Chrome PWA).
- **Ekran Yönü:** Yalnızca **Landscape**. Web App Manifest'te `"orientation": "landscape"` kullan; Android Chrome için destekleniyorsa `screen.orientation.lock('landscape')` dene; iOS Safari ve tüm cihazlar için dikey yönde etkileşimi durduran bir `LandscapeGuard` ekranı göster.
- **Dokunmatik Davranış:** 3D sahne ve kök oyun kabuğunda `touch-action: none`, `overscroll-behavior: none`, `-webkit-user-select: none` ve `-webkit-touch-callout: none` zorunludur.
- **iOS Standalone PWA & Safe Area:** `index.html` içinde `viewport-fit=cover`, `apple-mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style="black-translucent"` ve `apple-touch-icon` bulunmalıdır. Tüm HUD bileşenleri landscape modda Dynamic Island / kamera çentiği için `env(safe-area-inset-*)` kullanmalıdır.
- **Web Audio Kilidi:** `AudioContext` yalnızca ilk kullanıcı dokunuşunda (`pointerdown`/`touchstart`) senkron olarak açılmalı (`resume()`) ve iOS Safari arka plan dönüşleri (`visibilitychange` / `pageshow`) sonrasında sonraki dokunuşta yeniden etkinleştirilmelidir.
- **PWA Cache Güvenliği:** `vite-plugin-pwa` statik uygulama kabuğunu, ikonları, `/draco/` çözücüsünü ve `.glb` varlıklarını önbelleğe alabilir; ancak tüm Supabase REST/Auth/Realtime uçları kesinlikle `NetworkOnly` olmalıdır.

## 2. Teknoloji Yığını ve Render Kuralları
- **Zorunlu Yığın:** Vite, React 19, TypeScript (`strict: true`), Tailwind CSS, `@react-three/fiber` v9, `@react-three/drei`, Zustand, `vite-plugin-pwa`.
- **Sadece WebGL 2:** `@react-three/fiber` v9 standart WebGL 2 renderer ile kullanılacaktır. **WebGPU / `WebGPURenderer` (alpha) KESİNLİKLE KULLANMA.**
- **Mobil GPU Bütçesi:** `<Canvas dpr={[1, 2]}>` sınırı uygula; ağır post-processing (EffectComposer/Bloom/SSAO) ekleme.
- **60 FPS Durum Ayrımı:** Oyuncu pozisyonu, yönelimi ve lerp ara değerleri React state veya React'i her karede tetikleyen Zustand seçicilerinde TUTULMAZ. Kare başı güncellemeler `useFrame` içinde mutable ref / React dışı transient store (`playerMotionStore`) ile yapılır.

## 3. Fizik Motoru Yasağı ve Hareket Mimarisi
- **FİZİK MOTORU YASAK:** Rapier (`@react-three/rapier`), Cannon (`cannon-es`), Ammo.js, Oimo veya herhangi bir WASM fizik kütüphanesi ekleme.
- **Sabit Izgara + 2D AABB:** Mutfak sabit bir XZ ızgarasıdır (`1 birim = 1 metre`). Çarpışma ve duvar kaydırması saf TypeScript hafif 2D AABB (`src/domain/collision2d.ts`) ile, Tap-to-Move yön bulma saf TypeScript 2D ızgara A* (`src/domain/pathfinding.ts`) ile çözülür.
- **Kontrol Şeması:** Yalnızca **Tap-to-Move** (zemine dokun → yürü; istasyona dokun → istasyonun `interactionPoint` noktasına yürü, istasyona dön ve etkileş). Sanal joystick veya karmaşık serbest kamera ekleme.

## 4. Supabase Ağ, Kalıcılık ve Güvenlik Sözleşmesi
- **Pozisyon/Yön/Animasyon -> Sadece Realtime Broadcast:**
  - Yaklaşık **15 Hz throttle** (`~66 ms`) ile yalnızca hareket/durum değiştiğinde yayınla (+ duruş anında son paket).
  - Alıcı tarafta 60fps enterpolasyon (`lerp` / açısal `slerp`) uygula.
  - **Oyuncu koordinatlarını/animasyonunu Postgres veritabanına ASLA yazma.**
- **Online Durumu / Karakter Seçimi -> Realtime Presence:**
  - Tek paylaşımlı ev kanalında (`kitchen:home`) takip edilir.
- **Kalıcı Ev Durumu -> Postgres + Realtime Postgres Changes:**
  - Ortak cüzdan (`home_state`), ortak buzdolabı/hazırlık stoğu (`home_inventory`), istasyon durumu ve kilidi (`kitchen_stations.locked_by` + `lock_expires_at`), tarif ilerlemesi ve "Gerçekte Yaptık" kayıtları (`recipe_progress`) Postgres'te tutulur.
  - Kilit alma, satın alma, hazırlık ve pişirme işlemleri yarış durumunu (race condition) önlemek için **atomik Postgres RPC** fonksiyonlarıyla yapılır.
  - İstasyon kilitleri TTL (`lock_expires_at`) ve periyodik heartbeat kullanır; tarayıcı kapanması veya bağlantı kopması istasyonu kalıcı olarak kilitleyemez.
- **Tek Kişi & Çift Kişi Sorunsuz Çalışma:** Oda kurma veya oda kodu ekranı yoktur. Sabit tek kalıcı ev (`home`) hem tek oyuncuyla hem iki oyuncuyla aynı akışta çalışır.
- **Giriş:** Sabit 2 profil (`p1`, `p2`) + ortak PIN. RLS etkin olmalıdır; istemci tarafı kodlarda servis anahtarı (`service_role`) asla kullanılmaz.

## 5. 3D Asset Sözleşmesi
- **Önce Yer Tutucu (Placeholder):** Faz 1–3 boyunca tüm oyun ve ağ mekanikleri hafif yer tutucu geometrilerle tamamlanır; ilk aşamada gerçek model indirilmez veya harici CDN'e bağlanılmaz.
- **Soyutlama Zorunluluğu:** Tüm 3D varlıklar `src/scene/assets/assetManifest.ts` ve `ModelSlot.tsx` üzerinden yüklenir; `.glb` yoksa otomatik yer tutucu fallback çalışır.
- **`.glb` Standardı (`public/models/`):**
  - Ölçek: **1 birim = 1 metre**
  - Pivot: **Alt taban merkezinde** (`y = 0`, `x = 0`, `z = 0`)
  - Sıkıştırma: **Draco** (çözücü dosyaları `public/draco/` altında yerel barındırılır)
  - Animasyon klip adları (birebir): `Idle`, `Walk`, `Interact`
  - Karakter klonlama: İskeletli (skinned) karakterler **kesinlikle `SkeletonUtils.clone`** ile klonlanır.
  - Boyut bütçesi: Sahnedeki tüm modellerin toplamı **< 15 MB** olmalıdır.
- **GitHub Pages Yol Güvenliği:** `public/` altındaki tüm model, Draco ve ikon yolları `import.meta.env.BASE_URL` ile çözülür; kök-bağıl `/models/...` sabit dizgesi kullanılmaz.

## 6. İlk Sürüm (v1) Kapsam Sınırı
- **Sims Kapsamına Yayılma YASAK:** Açlık/enerji/ruh hali barları, oda inşa/dekorasyon modu, mobilya mağazası, çoklu oda, karakter editörü, XP/görev ağacı ekleme.
- **v1 Sabit İçerik:**
  - Tek mutfak
  - 3 istasyon: **Buzdolabı**, **Kesme Tahtası**, **Ocak**
  - **Market** ekranı
  - **3 tarif** (hızlı dokunmatik pişirme mini-oyunları + Tarif Defteri'nde gerçek hayat tarifi ve "Gerçekte Yaptık" onayı)

## 7. Kod Kalitesi, Modülerlik ve Dokümantasyon
- Domain mantığı (`src/domain/`) React, Three.js ve Supabase'den bağımsız saf TypeScript olmalı ve birim testleriyle (`Vitest`) kapsanmalıdır.
- Her yeni dosya ve değişiklik `tsc --noEmit` ve ilgili testlerden hatasız geçmelidir.
- **Zorunlu `AGENTS.md` Güncellemesi:** Projede yapılan her kod, özellik, kamera, UI, teknoloji, veritabanı veya yapılandırma güncellemesinden sonra kök dizindeki `AGENTS.md` dosyası (ilgili bölümler ve Güncelleme Günlüğü) mutlaka güncellenmelidir.
