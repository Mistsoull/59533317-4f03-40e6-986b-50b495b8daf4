# AGENTS.md — Bizim Mutfak / Unsere Küche

Bu belge, **Bizim Mutfak (Unsere Küche)** projesinin güncel mimarisini, kullanılan teknolojileri, şimdiye kadar yapılan tüm geliştirmeleri ve ajan çalışma kurallarını tek bir kaynakta toplar.

> **Zorunlu Ajan Kuralı:** Bu projede yapılan her kod, özellik, kamera, UI, veritabanı, asset veya yapılandırma güncellemesinden sonra bu dosya (`AGENTS.md`) — ilgili bölümler ve **Güncelleme Günlüğü** dahil — **mutlaka güncellenmelidir**. (Ayrıca bkz. `.agents/rules/kitchen-game-rules.md`.)

---

## 1. Proje Özeti

- **Tür:** 2 kişilik (aynı zamanda tek kişi de sorunsuz oynanabilen) izometrik 3D Web/PWA mutfak oyunu.
- **Hedef Platform & Cihazlar:** Yalnızca Web/PWA (native derleme yok) — **iPhone 17 Pro (iOS Safari PWA)** ve **Samsung Galaxy S23 (Android Chrome PWA)**, **yalnızca yatay (landscape)** ekran yönü.
- **Yayın (Canlı URL):** https://mistsoull.github.io/59533317-4f03-40e6-986b-50b495b8daf4/
- **Depo:** https://github.com/Mistsoull/59533317-4f03-40e6-986b-50b495b8daf4
- **Kapsam:** Sabit tek kalıcı ev (`home`), sabit 2 profil (`p1`, `p2`) + ortak PIN, tek mutfak (3 istasyon: **Buzdolabı**, **Kesme Tahtası**, **Ocak** + **Servis Zili/Bankosu**), yürünebilir **3D Mahalle Marketi** (3 tezgah), yürünebilir **3D Restoran Salonu** (3 bistro masası, yürüyen **Müşteri NPC**'leri ve otomatik **Garson NPC**) ve **3 tarif** (**Menemen**, **Çilekli Pankek**, **Kremalı Mantarlı Makarna**).

---

## 2. Kullanılan Teknolojiler ve Paketler

### Çekirdek Uygulama Yığını
| Katman | Teknoloji / Paket | Sürüm | Kullanım Amacı |
| :--- | :--- | :--- | :--- |
| Derleyici / Paketleyici | **Vite** + `@vitejs/plugin-react` | `^6.2.0` / `^4.3.4` | Hızlı geliştirme sunucusu, ES2022 üretim derlemesi, `BASE_URL` ile GitHub Pages uyumlu yollar |
| UI Çerçevesi | **React** / **React DOM** | `^19.0.0` | Bileşen tabanlı HUD, modallar, mini-oyunlar ve giriş ekranı |
| Dil | **TypeScript** (`strict: true`) | `^5.8.2` | Uçtan uca tip güvenliği (`tsc -b --noEmit`) |
| Stil & Tema | **Tailwind CSS** + `@tailwindcss/vite` | `^4.0.14` | `color-scheme`, `light-dark()`, `@custom-variant dark` ile Açık/Gece teması ve safe-area düzeni |
| İkonlar | **Lucide React** | `^0.479.0` | HUD, ayarlar ve modal ikonları |
| 3D Render Motoru | **Three.js**, **@react-three/fiber** v9, **@react-three/drei** v10 | `^0.174.0` / `^9.1.2` / `^10.0.7` | **Yalnızca WebGL 2** (WebGPU kullanılmaz), `dpr={[1, 2]}`, izometrik/perspektif kamera, `<Html>` etiketleri, `SkeletonUtils.clone` |
| Durum Yönetimi | **Zustand** | `^5.0.3` | React tarafı oturum, ev durumu, tema, dil ve ayar store'ları |
| 60 FPS Transient Store | Saf TS (`playerMotionStore`) | Dahili | Oyuncu koordinat/yönelim/lerp güncellemeleri React render tetiklemeden `useFrame` içinde çalışır |
| Hareket & Çarpışma | Saf TS 2D AABB + 2D Izgara A* | Dahili | Fizik motoru (Rapier/Cannon/WASM) olmadan Tap-to-Move yön bulma ve çarpışma çözümü |
| Ses | **Web Audio API** (`kitchenAudio`) | Dahili | Prosedürel ses efektleri; ilk dokunuşta senkron `resume()` ve iOS `visibilitychange`/`pageshow` kurtarması |
| PWA | **vite-plugin-pwa** (Workbox) | `^0.21.1` | Uygulama kabuğu, ikonlar, `/draco/` ve `.glb` önbellekleme; Supabase uçları kesinlikle `NetworkOnly`; `display: 'fullscreen'` |

### Backend, Ağ ve Kalıcılık
| Katman | Teknoloji | Kullanım Amacı |
| :--- | :--- | :--- |
| Cloud Backend | **Supabase** (`@supabase/supabase-js` `^2.49.1`) | Auth (`p1@home.local`, `p2@home.local`), Postgres + RLS, atomik PL/pgSQL RPC fonksiyonları |
| Gerçek Zamanlı Hareket | **Supabase Realtime Broadcast** | Oyuncu konumu, yönü, odası ve animasyonu (~15 Hz throttle + 3s idle heartbeat + alıcıda 60fps lerp/slerp). **Postgres'e asla yazılmaz.** |
| Çevrimiçi & Lobi Durumu | **Supabase Realtime Presence** | Tek ev kanalı (`kitchen:home`); giriş ekranında izole salt-okunur gözlemci istemci |
| Kalıcı Ev Senkronizasyonu | **Supabase Realtime Postgres Changes** | `profiles`, `home_state`, `home_inventory`, `kitchen_stations`, `recipe_progress`, `restaurant_orders` canlı senkronizasyonu |
| Yerel Fallback | `localStorage` + `sessionStorage` + `BroadcastChannel` | Supabase yapılandırması yoksa tarayıcı sekmeleri arasında yerel çok oyunculu demo modu |

### 3D Asset Pipeline, Test ve CI/CD
| Katman | Teknoloji | Kullanım Amacı |
| :--- | :--- | :--- |
| 3D Model Üretimi | **@gltf-transform/core, extensions, functions** (`^4.1.0`) + **draco3dgltf** (`^1.5.7`) | Prosedürel Draco sıkıştırmalı `.glb` üretimi (`scripts/generate-models.mjs`) ve yerel Draco çözücü (`public/draco/`) |
| Asset Doğrulama | Node betiği (`scripts/check-assets.mjs`) | Draco sıkıştırması, `y=0` taban pivotu, karakter iskelet/klip (`Idle`, `Walk`, `Interact`) ve `< 15 MB` bütçe kontrolü |
| Birim Testleri | **Vitest** (`^3.0.8`) | Saf TypeScript domain kuralları testleri (`src/test/*.test.ts`) |
| CI/CD & Hosting | **GitHub Actions** + **GitHub Pages** | `.github/workflows/deploy.yml`: `typecheck` -> `vitest` -> `check:assets` -> `vite build` -> Pages dağıtımı |

---

## 3. Zorunlu Mimari Kurallar Özeti

Tam bağlayıcı kurallar `.agents/rules/kitchen-game-rules.md` dosyasındadır:
1. **Sadece Web/PWA & Landscape:** Native wrapper eklenmez; `LandscapeGuard`, `touch-action: none`, `overscroll-behavior: none`, `viewport-fit=cover`, `env(safe-area-inset-*)` zorunludur.
2. **Sadece WebGL 2:** WebGPU (`WebGPURenderer`) ve ağır post-processing (Bloom/SSAO/EffectComposer) kullanılmaz; `<Canvas dpr={[1, 2]}>` korunur.
3. **Fizik Motoru Yasağı:** Rapier, Cannon, Ammo vb. eklenmez; yalnızca 2D AABB + 2D ızgara A* + Tap-to-Move kullanılır.
4. **Ağ Sözleşmesi:** Pozisyon/animasyon yalnızca Realtime Broadcast'ten akar (asla Postgres'e yazılmaz); kalıcı ev mutasyonları atomik Postgres RPC ile yapılır; istemcide `service_role` anahtarı asla yer almaz.
5. **3D Asset Sözleşmesi:** `public/models/*.glb` (1 birim = 1 m, alt merkez pivot `y = 0`, Draco sıkıştırmalı, toplam `< 15 MB`), karakterler `SkeletonUtils.clone` ile klonlanır, tüm yollar `import.meta.env.BASE_URL` ile çözülür.

---

## 4. Klasör ve Modül Yapısı

```text
.agents/rules/kitchen-game-rules.md   # Her zaman aktif zorunlu proje kuralları
.github/workflows/deploy.yml          # CI doğrulama ve GitHub Pages dağıtım hattı
public/
  draco/                              # Yerel barındırılan Draco WASM/JS çözücüleri
  icons/                              # PWA uygulama ikonları (192, 512, maskable, apple-touch)
  models/                             # 27 adet Draco .glb model (toplam 0.261 MB)
scripts/
  generate-models.mjs                 # 27 adet 3D .glb model üretici (karakterler, NPC'ler, istasyonlar, yiyecek/tabaklar, masa)
  generate-icons.mjs                  # PWA PNG ikon üretici
  check-assets.mjs                    # 3D asset sözleşme & boyut bütçesi doğrulayıcı
supabase/
  migrations/001..005_*.sql           # Şema, RLS, atomik RPC'ler, seed, profil/karakter ve restoran/garson sipariş migration'ları
  full_setup.sql                      # Tek seferlik kurulum SQL paketi
src/
  config/                             # Sabit tanımlar: characters, ingredients (raw/prepped/cooked), kitchenLayout, marketLayout, restaurantLayout, profiles, recipes
  domain/                             # Saf TS iş mantığı: audio, collision2d, fullscreen, lobbyOccupancy, pathfinding, restaurantRules, stationRules
  i18n/translations.ts                # Türkçe (tr) ve Almanca (de) tam yerelleştirme paketi
  scene/
    assets/                           # assetManifest, ModelSlot (+ fallback placeholders)
    entities/                         # LocalPlayer, RemotePlayer, WaiterNpc (2D A* otomatik servis), RestaurantGuests (yürüyen müşteriler)
    stations/                         # StationInteractable, MarketStallInteractable, ServicePassInteractable, RestaurantTableInteractable
    IsometricCamera.tsx               # Tam ekran 3 duvarlı iç mekan PerspectiveCamera (Mutfak, Restoran ve Market — sıfır dış boşluk)
    KitchenCanvas.tsx                 # WebGL 2 Canvas, ışıklar, 3 oda geçişi (unmount olmadan visible)
    KitchenRoom.tsx                   # Kapalı 3 duvarlı tam ekran Mutfak sahnesi ve duvar/tezgah dekoru
    MarketRoom.tsx                    # Kapalı 3 duvarlı tam ekran Mahalle Marketi sahnesi
    RestaurantRoom.tsx                # Kapalı 3 duvarlı tam ekran Restoran Salonu (3 masa, sokak girişi, servis pası)
    RoomDoor.tsx                      # Mutfak <-> Market ve Mutfak <-> Restoran yürüyerek geçiş kapıları
    TargetMarker.tsx                  # Zemin dokunma hedef halkası
  services/
    local/localHomeStore.ts           # Supabase yokken yerel kalıcılık & RPC simülasyonu (restoran + paket satış dahil)
    supabase/                         # client (+ izole lobby observer), auth, homeRepository (+ clockOffsetMs), realtimeSync, types
  store/                              # playerMotionStore, restaurantMotionStore, useGameStore, useSessionStore, useThemeStore, useLanguageStore, useSettingsStore
  test/                               # Vitest birim testleri (collision2d, pathfinding, stationRules, lobbyOccupancy, restaurantRules)
  ui/
    auth/ProfilePinGate.tsx           # Profil slotu, özel isim, 4 karakter seçici, canlı doluluk kilidi ve PIN tuş takımı
    common/ModalDialog.tsx            # Erişilebilir ortak modal kabuğu
    guards/LandscapeGuard.tsx         # Dikey yön engelleme katmanı
    hud/                              # TopHudBar (sade: Coin, Siparişler, Tarif Defteri, Ayarlar), ToastLayer (tıklanabilir sipariş bildirimi)
    minigames/                        # ChoppingMiniGame (Kesme Tahtası), CookingMiniGame (Ocak -> hazır tabak)
    modals/                           # FridgeModal, MarketModal, ServicePassModal (ortalı Siparişler & Servis popup'ı), RecipeBookModal, SettingsModal
```

---

## 5. Şimdiye Kadar Yapılanlar (Güncel Özellik Envanteri)

### Oyun Mekaniği, 3D Sahne ve Kamera
- **Mutfak Sahnesi (`KitchenRoom`):** Market gibi etrafında boşluk bırakmayan, 3 duvarlı tam ekran kapalı iç mekan çapraz `PerspectiveCamera` açısı (`[1.45, 5.35, 7.45]`, `lookAt(-0.1, 0.65, -0.65)`). 8m × 6m yürünebilir ızgara, engelsiz sağ arka duvarda **Buzdolabı** (`[3.22, 0, -2.42]`), orta-sol **Kesme Tahtası**, sağ-orta **Ocak**, sol duvarda **Market Kapısı**, sağ duvarda servis penceresi, **Servis Zili / Bankosu** (`[3.68, 0, 0.38]`) ve tam **Restoran Kapısı** (`[3.95, 0, 2.05]`).
- **Yürünebilir 3D Mahalle Marketi (`MarketRoom`):** HUD'da ışınlanma butonu yoktur; yalnızca kapılara yürüyerek geçilir. Etrafında boşluk bırakmayan, 3 duvarlı tam ekran kapalı iç mekan çapraz `PerspectiveCamera` açısı (`[2.35, 5.0, 6.7]`, `lookAt(-0.35, 0.92, -1.35)`). 3 etkileşimli tezgah (**Manav**, **Süt & Yumurta**, **Kuru Gıda**) ve sol arka duvarda **Mutfağa Dön** kapısı (`[-3.28, 0, -3.02]`).
- **Yürünebilir 3D Restoran Salonu & Otomatik Garson NPC (`RestaurantRoom`, `WaiterNpc`, `RestaurantGuests`):**
  - Mutfak'taki sağ bistro kapısından yürüyerek geçilen, etrafında boşluk bırakmayan 3 duvarlı tam ekran kapalı iç mekan (`PerspectiveCamera` `[1.45, 5.35, 7.45]`, `lookAt(-0.1, 0.65, -0.65)`), 3 bistro masası, sokak giriş kapısı ve restoran tarafı servis bankosu.
  - **Manuel Açılış & Deterministik Host:** `home_state.restaurant_open` varsayılanı `false` (servis manuel açılır). Oturum açılışında süresi dolmuş siparişler sessizce temizlenir. Presence üzerinden `p1` öncelikli Host seçimi + sunucu taraflı 8 sn cooldown + aktif masa limiti (1 kişi max 2, 2 kişi max 3 masa) + `get_server_time()` ile `clockOffsetMs` saat sapması telafisi çalışır.
  - **Zorluk Seviyesine Göre Teslim Süreleri & Cozy Mod:** Menemen (Kolay `90 sn`), Çilekli Pankek (Orta `120 sn`), Kremalı Mantarlı Makarna (Zor `150 sn`); tek oyuncuda otomatik `×1.35`. Kalan süre `>%50` ise hızlı servis bahşişi (`+%25`/`+%30`), `%20–%50` normal ücret, `<%20` `%85` ücret; süre dolunca **Cozy Mod** gereği coin cezası yok, sadece seri sıfırlanır.
  - **Otomatik Garson Teslimatı:** Pişen yemekler `stage = 'cooked'` stoğuna girer. Oyuncular tabağı elle taşımaz; yeni sipariş geldiğinde tıklanabilir bildirim çıkar ve üst çubuktaki **🔔 Siparişler** butonu (veya 3D **Servis Zili**) ile açılan ortalı **ServicePassModal** penceresinden **"Hazır / Gönder"** basıldığı an `serve_restaurant_order` RPC süreyi dondurup (`status = 'delivering'`) coin + bahşişi kilitler (garson yürürken sipariş asla zaman aşımına uğramaz). 3D **Garson NPC (`waiter.glb`)** 2D A* ile tabağı masaya götürür, müşteri ~4 sn yiyip kapıdan çıkar (sıfır DB pozisyon yazımı; 3D masa süre barları `useFrame` Three.js ref ile güncellenir; `pickNextSpawnCandidate` aynı müşterinin ve gereksiz yere aynı tarifin eşzamanlı 2 masada çıkmasını engeller).
  - **Fazla Tabak Paket Satışı:** `ServicePassModal` üzerinden fazla pişen tabaklar `sell_cooked_dish` RPC ile satılabilir; `needsPantrySupport` hazır tabak stoğunu da dikkate alır.
- **Oda Geçiş Performansı:** Her üç oda React ağacında canlı tutulur (`visible={currentRoom === ...}`), React 19 + drei `<Html>` unmount `removeChild` hatası engellenmiş, geçiş `< 1 ms` hıza indirilmiş ve Garson/Müşteri animasyonları mutfaktayken de kesintisiz çalışır.
- **Tap-to-Move & Çarpışma:** Saf TypeScript 2D AABB (`collision2d.ts`) ve 2D ızgara A* (`pathfinding.ts`). İstasyon, servis bankosu veya kapıya dokunulduğunda oyuncu otomatik `interactionPoint` noktasına yürür, yüzünü döner ve etkileşimi başlatır.
- **Mini-Oyunlar ve Tarif Defteri:**
  - **Kesme Tahtası (`ChoppingMiniGame`):** Yeşil zamanlama bölgesinde dokunarak ham malzemeleri doğrama (`complete_prep` RPC).
  - **Ocak (`CookingMiniGame`):** Isıyı altın bölgede tutup zamanlı karıştırma/çevirme ile 3 tarifi pişirip servise hazır tabak üretme (`complete_cook` RPC); bekleyen müşteri siparişleri rozetle vurgulanır.
  - **Tarif Defteri (`RecipeBookModal`):** 3 tarifin oyun içi gereksinimleri, isteğe bağlı açılıp kapatılabilen **Gerçek Hayat Tarifleri** (malzemeler, adımlar, şef notu) ve çift onay bonuslu **"Gerçekte Yaptık!"** akışı (`confirm_recipe_irl` RPC).
  - **Ekonomik Kilitlenme Koruması:** Kasa, hazır tabak ve stok boşaldığında ücretsiz `+50 Coin` destek paketi (`claim_pantry_support` RPC).

### 3D Asset Envanteri (`0.261 MB / 15.000 MB`)
- **4 İskeletli Oyuncu Karakteri (`SkeletonUtils.clone`, `Idle`/`Walk`/`Interact`):** `char_bubu.glb` (Bubu), `char_dudu.glb` (Dudu), `char_cat.glb` (Kedi), `char_dog.glb` (Köpek).
- **4 İskeletli Restoran NPC'si (`SkeletonUtils.clone`, `Idle`/`Walk`/`Interact`):** `waiter.glb` (Garson), `cust_fox.glb` (Tilki), `cust_bunny.glb` (Tavşan), `cust_bear.glb` (Ayıcık).
- **3 Mutfak İstasyonu & 1 Bistro Masası:** `station_fridge.glb`, `station_cutting_board.glb`, `station_stove.glb`, `restaurant_table.glb`.
- **9 Heykelimsi Ham Malzeme & 3 Servis Tabağı:** `food_domates`, `food_biber`, `food_yumurta`, `food_mantar`, `food_makarna`, `food_krema`, `food_cilek`, `food_un`, `food_sut` + `dish_menemen`, `dish_mantarli_makarna`, `dish_pankek`.
- **3 Market Tezgahı:** `market_produce.glb`, `market_dairy.glb`, `market_pantry.glb`.

### Çok Oyunculu, Supabase Cloud ve Giriş Koruması
- **Supabase Cloud Kurulumu:** `001_initial_schema.sql` – `004_profile_character.sql` şemaları, RLS politikaları, atomik RPC'ler ve `p1@home.local` / `p2@home.local` hesapları canlı Supabase projesinde yapılandırıldı.
- **İstasyon Kilidi & Heartbeat:** Kesme Tahtası ve Ocak için atomik `acquire_station_lock` (25s TTL), 10 saniyelik `heartbeat_station_lock`, çıkışta/sekme kapanışında `release_station_lock`.
- **Geç Katılan Oyuncu (Late-Joiner) Senkronizasyonu:** 4 katmanlı yapı — `SUBSCRIBED` anında `sync_request` el sıkışması (+ 1.2s tekrar deneme), Presence içinde başlangıç koordinat tohumlaması, Broadcast paketleriyle kendi kendini onaran `onlineProfiles`, `sessionNonce` ile yenileme sonrası paket koruması ve 3 saniyelik düşük frekanslı idle Broadcast kalp atışı (0 DB yazımı).
- **Giriş Ekranı Canlı Doluluk Kilidi (`ProfilePinGate` + `lobbyOccupancy.ts`):**
  - İzole salt-okunur `anon` Supabase Presence gözlemcisi (`.track()` çağırmaz, mevcut oyunculara sahte katılım bildirimi göndermez) + yerel `BroadcastChannel` desteği.
  - Oyunda aktif olan oyuncu slotu (`🔒 Oyunda` / `🔒 Im Spiel`) ve seçili karakter (`🔒 <İsim>`) `disabled` edilip tıklanamaz hale getirilir; yeni giren oyuncunun seçimi otomatik boş slota ve boş karaktere kaydırılır; her iki slot doluysa giriş engellenir.
  - Giriş öncesi ve `updateMyProfile` öncesinde çift yarış durumu kontrolü yapılır.

### Arayüz, Tema, Dil ve Mobil PWA
- **Özel İsim & 4 Karakter Seçimi:** Giriş ekranında oyuncu adını yazıp Bubu, Dudu, Kedi, Köpek arasından seçim yapabilir (`update_my_profile` RPC).
- **Canlı Açık Tema (Varsayılan) + Gece Modu:** `useThemeStore` + CSS `light-dark()` + Tailwind v4 özel `dark` varyantı.
- **Türkçe (`tr`) & Almanca (`de`) Dil Desteği:** Giriş ekranı, HUD, ayarlar, market, buzdolabı, mini-oyunlar, bildirimler ve gerçek hayat tarifleri dahil tam çeviri (`src/i18n/translations.ts`).
- **Sadeleştirilmiş HUD, Siparişler & Ortalı Ayarlar Penceresi (`TopHudBar`, `ServicePassModal`, `SettingsModal`, `ToastLayer`):**
  - Üst çubukta yalnızca sol tarafta ortak coin (`🪙`), sağ tarafta ise **🔔 Siparişler** (aktif sayı + acil/hazır rozetiyle ortalı popup açar), **Tarif Defteri** ve tek **⚙️ Ayarlar** butonu bulunur (sabit çevrimiçi/çevrimdışı rozeti, sabit sipariş şeridi, oda bilgisi, alt ipucu ve markete ışınlanma butonu kaldırıldı).
  - Yeni müşteri siparişi geldiğinde alt ortada tıklanabilir bildirim çıkar; dokunulduğunda doğrudan ortalı **Siparişler & Servis** penceresini açar.
  - Ortalı Ayarlar penceresinde: Dil (TR/DE), Görünüm (Açık/Gece), Tam Ekran Modu (`src/domain/fullscreen.ts`), Ses Efektleri, Gerçek Hayat Tarifleri aç/kapa (`useSettingsStore`) ve Çıkış Yap yer alır.
- **Android/iOS Tam Ekran PWA:** Manifest `display: 'fullscreen'` (`display_override: ['fullscreen', 'standalone']`), `orientation: 'landscape'` ve iOS standalone meta etiketleri.

---

## 6. Geliştirme ve Doğrulama Komutları

Her değişiklik sonrası dağıtım öncesi aşağıdaki kontroller hatasız geçmelidir:

```bash
npm run typecheck     # TypeScript strict kontrolü (tsc -b --noEmit)
npm test              # Vitest birim testleri (şu an 5 dosya, 19 test)
npm run check:assets  # 27 .glb modelin Draco, pivot, klip ve <15 MB bütçe kontrolü
npm run build         # Üretim derlemesi + PWA Service Worker (GitHub Pages için VITE_BASE_PATH ile)
```

Diğer yardımcı komutlar:
- `npm run dev` — Yerel geliştirme sunucusu
- `npm run preview` — Üretim derlemesi yerel önizleme
- `npm run generate:models` — 19 Draco `.glb` modelini yeniden üretir

---

## 7. Güncelleme Günlüğü (Changelog)

| Tarih | Commit | Özet |
| :--- | :--- | :--- |
| 2026-11-25 | `429e714` | v1 temel sürüm: Vite + React 19 + R3F v9 (WebGL 2) + Zustand + PWA + 2D AABB/A* + 3 istasyon + 3 tarif + mini-oyunlar + Tarif Defteri (Gerçekte Yaptık) + Supabase şema/RPC/Realtime + GitHub Pages CI/CD. |
| 2026-11-25 | `eda9bcd` | Daha büyük mutfak kadrajı, engelsiz sağ duvara taşınan buzdolabı, canlı Açık Tema + Gece Modu, 9 heykelimsi yiyecek `.glb`, Bubu/Dudu/Kedi/Köpek karakterleri + özel isim seçimi, yürünebilir 3D Mahalle Marketi ve canlı Supabase Cloud kurulumu. |
| 2026-11-25 | `74b893d` | Geç katılan (Oyuncu 2) çok oyunculu senkronizasyon düzeltmesi (`sync_request` + Presence koordinatları + 3s idle heartbeat), TR/DE çoklu dil, ortalı `⚙️` Ayarlar penceresi, yürüyerek Market kapısı (HUD butonu/konum/ipucu temizliği), tam ekran 3 duvarlı Market iç mekanı. |
| 2026-11-25 | `1fa2926` | Ayarlara Gerçek Hayat Tarifleri aç/kapa eklendi, üst HUD'dan kendi çevrimiçi rozeti kaldırıldı, çapraz kamera açıları uygulandı. |
| 2026-11-25 | `55cd7bf` | PWA manifest `display: 'fullscreen'` ve Ayarlara Tam Ekran Modu (`fullscreen.ts`) eklendi; yüksek açılı kamera denendi. |
| 2026-11-25 | `51d9307` | Mutfak kamerası klasik izometrik açıya (`[10.5, 10.2, 13.0]`) döndürüldü; yüksek açılı kamera Market'e alındı. |
| 2026-11-25 | `cc15f26` | Market kamerası kullanıcı geri bildirimi üzerine önceki tam ekran çapraz iç mekan açısına (`[2.35, 5.0, 6.7]`) geri alındı. |
| 2026-11-25 | `5263954` | Giriş ekranında canlı Presence ile oyundaki oyuncu slotu ve karakterini tıklanamaz yapma, boş slota/karaktere otomatik geçiş ve `lobbyOccupancy` birim testleri eklendi. |
| 2026-11-25 | `b849492` | Proje özeti, teknoloji yığını, mimari ve değişiklik günlüğünü içeren `AGENTS.md` oluşturuldu; `.agents/rules/kitchen-game-rules.md` içine her güncellemede `AGENTS.md` güncelleme zorunluluğu eklendi. |
| 2026-11-25 | `cd46a52` | Mutfak'a bağlı yürünebilir **3D Restoran Salonu** (3 masa), yürüyen 3D müşteri NPC'leri, otomatik 3D **Garson NPC** (`waiter.glb`), zorluk bazlı teslim süreleri (90/120/150sn + tek kişi ×1.35 + Cozy Mod), manuel restoran açılışı, deterministik Host + sunucu cooldown/limit, `clockOffsetMs`, tüm odalarda canlı `OrderTicketBar`, `ServicePassModal`, `sell_cooked_dish` RPC, 8 yeni Draco `.glb` ve `005_restaurant_orders.sql` canlı Supabase Cloud kurulumu eklendi. |
| 2026-11-25 | `134bba2` | Mutfak (`KitchenRoom`) ve Restoran (`RestaurantRoom`) da Market gibi etrafında hiç boşluk bırakmayan 3 duvarlı tam ekran kapalı iç mekan `PerspectiveCamera` (`[1.45, 5.35, 7.45]`, `lookAt(-0.1, 0.65, -0.65)`) mimarisine geçirildi; Mutfak sağ duvarına servis penceresi ve tam boy bistro kapısı eklendi. |
| 2026-11-25 | *(güncel)* | Aynı müşterinin/tarifin eşzamanlı iki masada çıkması engellendi (`pickNextSpawnCandidate` + `useGameStore` masa bazlı tekilleştirme); sabit `OrderTicketBar` ve üst HUD'daki sabit çevrimiçi rozeti kaldırıldı; yeni siparişlerde tıklanabilir bildirim (`ToastLayer`) + üst çubukta ortalı **Siparişler & Servis** popup'ını açan **🔔 Siparişler** butonu eklendi. |
