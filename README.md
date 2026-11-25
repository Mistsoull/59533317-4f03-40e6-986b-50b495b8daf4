# 🍳 Bizim Mutfak — 2 Kişilik İzometrik 3D Web/PWA Mutfak Oyunu

iPhone 17 Pro (Safari PWA) ve Samsung Galaxy S23 (Chrome PWA) için **landscape** odaklı tasarlanmış, tek kişiyle de sorunsuz oynanabilen kalıcı tek evli 2 kişilik izometrik 3D mutfak oyunu.

## Özellikler (v1)
- **İzometrik 3D Mutfak (`@react-three/fiber` v9 — WebGL 2):** Fizik motoru olmadan saf TypeScript 2D AABB çarpışma + 2D ızgara A* Tap-to-Move.
- **Draco `.glb` Asset Hattı:** Self-hosted `public/draco/` çözücü, `SkeletonUtils.clone` iskeletli şefler (`Idle`, `Walk`, `Interact`), toplam sahne bütçesi `< 0.1 MB` (bütçe sınırı `15 MB`).
- **3 İstasyon + Market + 3 Tarif:**
  - **Buzdolabı:** Ortak ev stoğu (ham & hazırlanmış malzemeler).
  - **Kesme Tahtası:** Dokunmatik ritim doğrama mini-oyunu + atomik kilit (`locked_by`).
  - **Ocak:** Dokunmatik ısı kontrolü & karıştırma/çevirme mini-oyunu + atomik kilit.
  - **Tarif Defteri:** *Menemen*, *Kremalı Mantarlı Makarna* ve *Çilekli Pankek* için gerçek hayat tarifleri ve tek/çift onaylı **"Gerçekte Yaptık!"** kaydı.
- **Supabase Ağ Mimarisi:**
  - Konum/yön/animasyon → yalnızca **Realtime Broadcast (~15 Hz)** (Postgres'e asla yazılmaz).
  - Online durumu → **Realtime Presence**.
  - Cüzdan, stok, istasyon kilidi (TTL + heartbeat) ve tarif ilerlemesi → **Postgres + Postgres Changes + Atomik RPC**.
- **Mobil PWA:** `touch-action: none`, `viewport-fit=cover`, safe-area HUD, `LandscapeGuard`, ilk dokunuşta iOS Safari Web Audio kilidi açma ve `NetworkOnly` Supabase önbellek politikası.

## Geliştirme Komutları
```bash
npm install
npm run dev            # Yerel geliştirme sunucusu (Demo PIN: 1234)
npm run typecheck      # Strict TypeScript kontrolü
npm test               # Vitest birim testleri (2D AABB, A*, istasyon kuralları)
npm run check:assets   # Draco .glb sözleşme ve < 15 MB bütçe kontrolü
npm run build          # Prodüksiyon PWA derlemesi
```

## Supabase Bulut Bağlantısı
İki farklı telefon arasında canlı senkronizasyon için [supabase/README.md](supabase/README.md) dosyasındaki 3 adımı takip edebilirsiniz.
