import type { CharacterId } from '../config/characters';
import type { StationId } from '../config/kitchenLayout';
import type { MarketStallId } from '../config/marketLayout';
import type { RecipeId } from '../config/recipes';
import type { Language } from '../store/useLanguageStore';

export interface LocalizedRecipeIrl {
  name: string;
  tagline: string;
  cookActionLabel: string;
  prepTime: string;
  servings: string;
  difficulty: string;
  ingredients: readonly string[];
  steps: readonly string[];
  chefTip: string;
}

interface TranslationBundle {
  appTitle: string;
  loadingKitchen: string;
  rotateTitle: string;
  rotateDesc: string;

  // Auth / Login
  cloudActive: string;
  localMode: (pin: string) => string;
  playerSlot: (idx: number) => string;
  namePlaceholder: string;
  nameAriaLabel: string;
  chooseCharacter: string;
  sharedPin: string;
  enterBtn: string;
  supabaseSetupTitle: string;
  supabaseSetupDesc: string;
  saveBtn: string;
  cancelBtn: string;
  closeLabel: string;

  // HUD & Settings
  online: string;
  offline: string;
  localTag: string;
  recipeBook: string;
  settingsTitle: string;
  settingsSubtitle: string;
  settingsAria: string;
  languageLabel: string;
  themeLabel: string;
  lightTheme: string;
  darkTheme: string;
  soundLabel: string;
  soundOn: string;
  soundOff: string;
  realLifeRecipesLabel: string;
  fullscreenLabel: string;
  fullscreenEnter: string;
  fullscreenExit: string;
  enabledLabel: string;
  disabledLabel: string;
  signOutBtn: string;

  // Rooms & Doors
  goToMarketDoor: string;
  backToKitchenDoor: string;
  enteredMarketToast: string;
  enteredKitchenToast: string;

  // Stations & Locks
  stations: Record<StationId, { label: string; subtitle: string }>;
  stationUsingBadge: (name: string) => string;
  stationLockedToast: (name: string, stationLabel: string) => string;

  // Market
  marketAllTab: string;
  marketTitle: string;
  marketSubtitle: string;
  marketStalls: Record<MarketStallId, { label: string; subtitle: string }>;
  inFridgeCount: (n: number) => string;
  buying: string;
  buyOne: (price: number) => string;
  notEnoughCoins: string;
  boughtToast: (name: string) => string;
  buyFailedToast: string;
  pantrySupportText: string;
  pantrySupportBtn: string;
  pantrySupportToast: string;

  // Fridge
  fridgeTitle: string;
  fridgeSubtitle: string;
  rawIngredients: string;
  preppedIngredients: string;
  chopHint: string;
  fridgeCoopTip: string;
  walkToMarketHint: string;

  // Chopping Mini-Game
  choppingSelectSub: string;
  choppingActiveSub: (name: string) => string;
  rawShort: (n: number) => string;
  readyShort: (n: number) => string;
  chopBtn: string;
  noRawToChop: string;
  chopGreat: string;
  chopMiss: string;
  chopReadyPrompt: string;
  chopActionBtn: (done: number, total: number) => string;
  saving: string;
  preppedToast: (icon: string, name: string) => string;
  missingRawToast: string;

  // Cooking Mini-Game
  stoveSelectSub: string;
  stoveActiveSub: (name: string) => string;
  startCooking: string;
  prepareIngredients: string;
  stoveMarketHint: string;
  cookProgressLabel: (icon: string, name: string) => string;
  stoveHeatLabel: string;
  heatGolden: string;
  heatLow: string;
  heatHigh: string;
  holdFlameBtn: string;
  nowActionBtn: (action: string) => string;
  waitingActionBtn: (action: string) => string;
  cookedToast: (icon: string, name: string, coins: number) => string;
  missingIngredientsToast: string;

  // Recipe Book & IRL
  recipeBookSubtitle: string;
  inGameCount: (n: number) => string;
  irlCount: (n: number) => string;
  inGameIngredients: string;
  rewardLabel: (coins: number) => string;
  realLifeRecipeTitle: (name: string) => string;
  ingredientsHeading: string;
  stepsHeading: string;
  chefTipHeading: string;
  madeItIrlTitle: string;
  notePlaceholder: string;
  madeItAgainBtn: string;
  confirmedWaitingPartner: string;
  confirmPartnerBtn: string;
  confirmFirstBtn: string;
  bothConfirmedToast: (name: string) => string;
  singleConfirmedToast: (name: string) => string;

  // Presence toasts
  partnerJoinedToast: (name: string) => string;
  partnerLeftToast: (name: string) => string;

  // Entities
  characters: Record<CharacterId, { name: string; tagline: string }>;
  ingredients: Record<string, string>;
  recipes: Record<RecipeId, LocalizedRecipeIrl>;
}

export const TRANSLATIONS: Record<Language, TranslationBundle> = {
  tr: {
    appTitle: 'Bizim Mutfak',
    loadingKitchen: '🍳 Mutfak hazırlanıyor...',
    rotateTitle: 'Telefonunu Yatay Çevir',
    rotateDesc:
      'Bizim Mutfak yalnızca yatay (landscape) modda oynanır. Cihazını yan çevirdiğinde mutfak otomatik açılacak.',

    cloudActive: 'Bulut Aktif',
    localMode: (pin) => `Yerel (${pin})`,
    playerSlot: (idx) => `Oyuncu ${idx}`,
    namePlaceholder: 'İsmini yaz (örn: Uğur)...',
    nameAriaLabel: 'Oyuncu İsmi',
    chooseCharacter: 'Karakterini Seç',
    sharedPin: 'Ortak PIN',
    enterBtn: 'GİR',
    supabaseSetupTitle: 'Supabase Bağlantısı',
    supabaseSetupDesc:
      'Project URL ve public Anon Key ayarını buradan değiştirebilirsiniz.',
    saveBtn: 'Kaydet',
    cancelBtn: 'Vazgeç',
    closeLabel: 'Kapat',

    online: 'çevrimiçi',
    offline: 'çevrimdışı',
    localTag: 'Yerel',
    recipeBook: 'Tarif Defteri',
    settingsTitle: 'Ayarlar',
    settingsSubtitle: 'Dil, tema, ses ve hesap ayarları',
    settingsAria: 'Ayarlar',
    languageLabel: 'Dil / Sprache',
    themeLabel: 'Görünüm (Tema)',
    lightTheme: 'Açık Tema',
    darkTheme: 'Gece Modu',
    soundLabel: 'Ses Efektleri',
    soundOn: 'Ses Açık',
    soundOff: 'Ses Kapalı',
    realLifeRecipesLabel: 'Gerçek Hayat Tarifleri',
    fullscreenLabel: 'Tam Ekran Modu',
    fullscreenEnter: 'Tam Ekran Yap',
    fullscreenExit: 'Tam Ekrandan Çık',
    enabledLabel: 'Açık',
    disabledLabel: 'Kapalı',
    signOutBtn: 'Çıkış Yap / Profil Değiştir',

    goToMarketDoor: 'Markete Git',
    backToKitchenDoor: 'Mutfağa Dön',
    enteredMarketToast: '🛒 Mahalle Marketine geldin!',
    enteredKitchenToast: '🏠 Mutfağa döndün!',

    stations: {
      fridge: { label: 'Buzdolabı', subtitle: 'Ortak Ev Stoğu' },
      cutting_board: { label: 'Kesme Tahtası', subtitle: 'Malzeme Hazırlığı' },
      stove: { label: 'Ocak', subtitle: 'Yemek Pişirme' },
    },
    stationUsingBadge: (name) => `🔒 ${name} kullanıyor`,
    stationLockedToast: (name, st) => `🔒 ${name} şu an ${st} istasyonunu kullanıyor!`,

    marketAllTab: '🛒 Tümü',
    marketTitle: 'Mahalle Marketi',
    marketSubtitle: 'Alınan malzemeler anında ortak buzdolabına gider.',
    marketStalls: {
      produce: { label: 'Manav Tezgahı', subtitle: 'Taze Sebze & Meyve' },
      dairy: { label: 'Süt & Yumurta', subtitle: 'Soğuk Kahvaltılık' },
      pantry: { label: 'Kuru Gıda Rafı', subtitle: 'Makarna & Un' },
    },
    inFridgeCount: (n) => `Dolapta: ×${n}`,
    buying: 'Alınıyor...',
    buyOne: (price) => `+1 Al · 🪙 ${price}`,
    notEnoughCoins: 'Yeterli coin yok! Yemek pişirerek coin kazanabilirsin.',
    boughtToast: (name) => `${name} alındı ve evdeki buzdolabına gönderildi!`,
    buyFailedToast: 'Satın alma tamamlanamadı.',
    pantrySupportText: 'Kasa ve dolap neredeyse boş! Ücretsiz destek paketi alabilirsin.',
    pantrySupportBtn: '+50 Coin Al',
    pantrySupportToast: '+50 Coin Mutfak Destek Paketi eklendi!',

    fridgeTitle: 'Ortak Buzdolabı',
    fridgeSubtitle: 'Evdeki tüm ham ve doğranmış malzemeler anlık senkronize olur.',
    rawIngredients: 'Ham Malzemeler',
    preppedIngredients: 'Hazırlanmış (Ocak İçin Hazır)',
    chopHint: 'Kesme tahtasında doğranır',
    fridgeCoopTip:
      '💡 İpucu: Biriniz Kesme Tahtasında doğrama yaparken diğeriniz Ocakta yemeği pişirebilir!',
    walkToMarketHint: '🛒 Malzeme almak için sol duvardaki Market kapısından yürüyerek çıkabilirsin.',

    choppingSelectSub: 'Hazırlamak istediğin malzemeyi seç',
    choppingActiveSub: (name) => `${name} doğranıyor — imleç yeşil alandayken dokun!`,
    rawShort: (n) => `Ham: ×${n}`,
    readyShort: (n) => `Hazır: ×${n}`,
    chopBtn: 'Doğra',
    noRawToChop: 'Doğranacak ham malzeme kalmadı. Market kapısından yürüyerek yeni malzeme alabilirsin.',
    chopGreat: 'Harika kesim! ✨',
    chopMiss: 'Yeşil bölgede dokun!',
    chopReadyPrompt: 'Hazır olduğunda dokun!',
    chopActionBtn: (done, total) => `🔪 DOĞRA! (${done}/${total})`,
    saving: 'Kaydediliyor...',
    preppedToast: (icon, name) => `${icon} ${name} hazır!`,
    missingRawToast: 'Ham malzeme stoğu kalmadı.',

    stoveSelectSub: 'Pişirmek istediğin tarifi seç',
    stoveActiveSub: (name) => `${name} pişiyor — ısıyı altın bölgede tut!`,
    startCooking: '🔥 Pişirmeye Başla',
    prepareIngredients: 'Malzeme Hazırla',
    stoveMarketHint:
      'Eksik malzeme için sol kapıdan Markete yürüyebilir, sebzeleri Kesme Tahtasında doğrayabilirsin.',
    cookProgressLabel: (icon, name) => `${icon} ${name} Pişme İlerlemesi`,
    stoveHeatLabel: 'Ocak Isısı',
    heatGolden: '✨ Altın Pişirme Bölgesi!',
    heatLow: 'Isı Düşük',
    heatHigh: 'Çok Sıcak!',
    holdFlameBtn: 'ATEŞİ AÇ (Basılı Tut)',
    nowActionBtn: (action) => `✨ ŞİMDİ ${action.toUpperCase()}! (+18%)`,
    waitingActionBtn: (action) => `${action} Bekleniyor...`,
    cookedToast: (icon, name, coins) => `${icon} ${name} nefis oldu! +${coins} Coin`,
    missingIngredientsToast: 'Malzeme eksik — pişirme tamamlanamadı.',

    recipeBookSubtitle: '3 tarifin gerçek hayat reçetesi ve Gerçekte Yaptık onayı',
    inGameCount: (n) => `Oyunda: ${n}×`,
    irlCount: (n) => `Gerçekte: ${n}×`,
    inGameIngredients: 'Oyun İçi Malzemeler',
    rewardLabel: (coins) => `Ödül: +🪙 ${coins}`,
    realLifeRecipeTitle: (name) => `Gerçek Hayat Tarifi — ${name}`,
    ingredientsHeading: 'Malzemeler',
    stepsHeading: 'Hazırlanışı',
    chefTipHeading: 'Şef Notu:',
    madeItIrlTitle: 'Gerçekte Yaptık!',
    notePlaceholder: 'Kısa anı notu (isteğe bağlı)...',
    madeItAgainBtn: 'Tekrar Yaptık (+30 🪙)',
    confirmedWaitingPartner: 'Onayladın ✓ (Partner bekleniyor)',
    confirmPartnerBtn: 'Ben de Onaylıyorum (+50 🪙)',
    confirmFirstBtn: 'Gerçekte Yaptık! (+30 🪙)',
    bothConfirmedToast: (name) =>
      `🎉 İkiniz de ${name} tarifini gerçekte onayladınız! +50 Bonus Coin`,
    singleConfirmedToast: (name) =>
      `🍽️ ${name} "Gerçekte Yaptık" olarak kaydedildi! +30 Coin`,

    partnerJoinedToast: (name) => `${name} oyuna katıldı!`,
    partnerLeftToast: (name) => `${name} ayrıldı.`,

    characters: {
      bubu: { name: 'Bubu', tagline: 'Minnoş Panda' },
      dudu: { name: 'Dudu', tagline: 'Sıcak Ayıcık' },
      cat: { name: 'Kedi', tagline: 'Tatlı Tekir' },
      dog: { name: 'Köpek', tagline: 'Neşeli Golden' },
    },

    ingredients: {
      domates: 'Domates',
      biber: 'Yeşil Biber',
      yumurta: 'Yumurta',
      mantar: 'Kültür Mantarı',
      makarna: 'Makarna',
      krema: 'Sıvı Krema',
      cilek: 'Taze Çilek',
      un: 'Buğday Unu',
      sut: 'Günlük Süt',
      domates_dogranmis: 'Doğranmış Domates',
      biber_dogranmis: 'Doğranmış Biber',
      mantar_dilim: 'Dilimlenmiş Mantar',
      cilek_dilim: 'Dilimlenmiş Çilek',
    },

    recipes: {
      menemen: {
        name: 'Menemen',
        tagline: 'Sıcak kahvaltı klasiği — domates ve biberi doğra, ocakta harmanla.',
        cookActionLabel: 'Karıştır',
        prepTime: '15 dk',
        servings: '2 kişilik',
        difficulty: 'Kolay',
        ingredients: [
          '3 adet olgun orta boy domates (kabuğu soyulup küp doğranmış)',
          '2 adet yeşil sivri veya çarliston biber (ince doğranmış)',
          '3 adet yumurta',
          '2 yemek kaşığı zeytinyağı + 1 tatlı kaşığı tereyağı',
          '1 çay kaşığı tuz, yarım çay kaşığı karabiber ve pul biber',
        ],
        steps: [
          'Geniş tavada zeytinyağı ve tereyağını orta ateşte ısıtıp ince doğranmış biberleri 3-4 dakika yumuşayana kadar soteleyin.',
          'Küp doğranmış domatesleri ekleyip kapağını kapatarak 6-7 dakika suyunu hafifçe çekene kadar pişirin.',
          'Tuz ve baharatları ilave edip karıştırın.',
          'Yumurtaları doğrudan tavaya kırın; hafifçe dağıtarak (çok kurutmadan) 2 dakika pişirin.',
          'Sıcakken taze ekmekle servis edin.',
        ],
        chefTip:
          'Yumurtayı tamamen çırpmadan beyazları hafif pişince sarıları dağıtırsanız lokanta kıvamı yakalarsınız.',
      },
      mantarli_makarna: {
        name: 'Kremalı Mantarlı Makarna',
        tagline: 'İpeksi mantar soslu akşam yemeği — mantarı dilimle, krema ile bağla.',
        cookActionLabel: 'Harmanla',
        prepTime: '25 dk',
        servings: '2 kişilik',
        difficulty: 'Orta',
        ingredients: [
          '250 g penne veya tagliatelle makarna',
          '250 g kültür mantarı (nemli bezle silinip dilimlenmiş)',
          '200 ml sıvı krema',
          '2 diş ince doğranmış sarımsak',
          '1 yemek kaşığı tereyağı + 1 yemek kaşığı zeytinyağı',
          'Yarım kepçe makarna haşlama suyu, tuz, karabiber, isteğe bağlı parmesan',
        ],
        steps: [
          'Makarnayı bol tuzlu kaynar suda paketteki süreden 1 dakika eksik (al dente) haşlayın; yarım kepçe suyunu ayırın.',
          'Geniş tavada yağları kızdırıp dilimlenmiş mantarları yüksek ateşte altın rengi alana kadar soteleyin.',
          'Sarımsakları ekleyip 30 saniye çevirin, ardından kremayı döküp kısık ateşte 3 dakika kaynatın.',
          'Haşlanan makarnayı ve makarna suyunu tavaya ekleyip 1-2 dakika sosla harmanlayın.',
          'Taze karabiber ve parmesan ile hemen servis edin.',
        ],
        chefTip:
          'Mantarları yıkamak yerine nemli bezle silip yüksek ateşte sotelemek suyunu salmadan karamelize olmasını sağlar.',
      },
      pankek: {
        name: 'Çilekli Pankek',
        tagline: 'Yumuşacık tatlı mola — çilekleri dilimle, tavada altın gibi çevir.',
        cookActionLabel: 'Çevir',
        prepTime: '20 dk',
        servings: '2 kişilik',
        difficulty: 'Kolay',
        ingredients: [
          '1 su bardağı un',
          '1 su bardağı süt',
          '1 adet yumurta',
          '2 yemek kaşığı toz şeker + 1 paket vanilin + 1 çay kaşığı kabartma tozu',
          '1 yemek kaşığı sıvı yağ + 1 kase dilimlenmiş taze çilek',
        ],
        steps: [
          'Yumurta ve şekeri çırpın; süt ve sıvı yağı ekleyip karıştırın.',
          'Un, kabartma tozu ve vanilini eleyerek ekleyin; pürüzsüz akışkan bir hamur elde edin.',
          'Hafifçe yağlanmış yapışmaz tavayı orta-kısık ateşte ısıtıp kepçe ile küçük daireler dökün.',
          'Üzerinde kabarcıklar çıkıp kenarları matlaştığında spatula ile çevirip diğer yüzünü 1 dakika pişirin.',
          'Dilimlenmiş çilekler ve bal ile üst üste dizip servis edin.',
        ],
        chefTip:
          'Hamuru fazla çırpmayıp 5 dakika dinlendirirseniz pankekler çok daha kabarık ve süngerimsi olur.',
      },
    },
  },

  de: {
    appTitle: 'Unsere Küche',
    loadingKitchen: '🍳 Küche wird vorbereitet...',
    rotateTitle: 'Bitte drehe dein Gerät',
    rotateDesc:
      'Unsere Küche wird im Querformat (Landscape) gespielt. Drehe dein Gerät waagerecht, um weiterzuspielen.',

    cloudActive: 'Cloud aktiv',
    localMode: (pin) => `Lokal (${pin})`,
    playerSlot: (idx) => `Spieler ${idx}`,
    namePlaceholder: 'Dein Name (z.B. Anna)...',
    nameAriaLabel: 'Spielername',
    chooseCharacter: 'Charakter wählen',
    sharedPin: 'Gemeinsame PIN',
    enterBtn: 'LOS',
    supabaseSetupTitle: 'Supabase-Verbindung',
    supabaseSetupDesc:
      'Hier kannst du Projekt-URL und öffentlichen Anon-Key anpassen.',
    saveBtn: 'Speichern',
    cancelBtn: 'Abbrechen',
    closeLabel: 'Schließen',

    online: 'online',
    offline: 'offline',
    localTag: 'Lokal',
    recipeBook: 'Rezeptbuch',
    settingsTitle: 'Einstellungen',
    settingsSubtitle: 'Sprache, Design, Ton und Profil',
    settingsAria: 'Einstellungen',
    languageLabel: 'Sprache / Dil',
    themeLabel: 'Design (Modus)',
    lightTheme: 'Hell',
    darkTheme: 'Nachtmodus',
    soundLabel: 'Soundeffekte',
    soundOn: 'Ton an',
    soundOff: 'Ton aus',
    realLifeRecipesLabel: 'Echte Rezepte',
    fullscreenLabel: 'Vollbildmodus',
    fullscreenEnter: 'Vollbild an',
    fullscreenExit: 'Vollbild aus',
    enabledLabel: 'An',
    disabledLabel: 'Aus',
    signOutBtn: 'Abmelden / Profil wechseln',

    goToMarketDoor: 'Zum Markt',
    backToKitchenDoor: 'Zur Küche',
    enteredMarketToast: '🛒 Willkommen im Nachbarschaftsmarkt!',
    enteredKitchenToast: '🏠 Zurück in der Küche!',

    stations: {
      fridge: { label: 'Kühlschrank', subtitle: 'Gemeinsamer Vorrat' },
      cutting_board: { label: 'Schneidebrett', subtitle: 'Zutaten vorbereiten' },
      stove: { label: 'Herd', subtitle: 'Kochen & Braten' },
    },
    stationUsingBadge: (name) => `🔒 ${name} kocht gerade`,
    stationLockedToast: (name, st) => `🔒 ${name} benutzt gerade: ${st}!`,

    marketAllTab: '🛒 Alle',
    marketTitle: 'Nachbarschaftsmarkt',
    marketSubtitle: 'Gekaufte Zutaten landen direkt im gemeinsamen Kühlschrank.',
    marketStalls: {
      produce: { label: 'Gemüsestand', subtitle: 'Frisches Obst & Gemüse' },
      dairy: { label: 'Milch & Eier', subtitle: 'Frisch aus der Kühlung' },
      pantry: { label: 'Vorratsregal', subtitle: 'Pasta & Mehl' },
    },
    inFridgeCount: (n) => `Im Kühlschrank: ×${n}`,
    buying: 'Kauft...',
    buyOne: (price) => `+1 Kaufen · 🪙 ${price}`,
    notEnoughCoins: 'Nicht genug Münzen! Koche ein Gericht, um Münzen zu verdienen.',
    boughtToast: (name) => `${name} gekauft und in den Kühlschrank gelegt!`,
    buyFailedToast: 'Kauf fehlgeschlagen.',
    pantrySupportText: 'Kasse und Kühlschrank sind fast leer! Hol dir ein gratis Hilfspaket.',
    pantrySupportBtn: '+50 Münzen',
    pantrySupportToast: '+50 Münzen Küchenhilfe erhalten!',

    fridgeTitle: 'Gemeinsamer Kühlschrank',
    fridgeSubtitle: 'Alle frischen und geschnittenen Zutaten synchronisieren in Echtzeit.',
    rawIngredients: 'Frische Zutaten',
    preppedIngredients: 'Vorbereitet (Bereit für den Herd)',
    chopHint: 'Auf dem Schneidebrett schneiden',
    fridgeCoopTip:
      '💡 Tipp: Einer kann am Schneidebrett schnippeln, während der andere am Herd kocht!',
    walkToMarketHint: '🛒 Gehe durch die Markttür links, um neue Zutaten einzukaufen.',

    choppingSelectSub: 'Wähle eine Zutat zum Schneiden',
    choppingActiveSub: (name) => `${name} schneiden — tippe im grünen Bereich!`,
    rawShort: (n) => `Roh: ×${n}`,
    readyShort: (n) => `Fertig: ×${n}`,
    chopBtn: 'Schneiden',
    noRawToChop: 'Keine rohen Zutaten mehr da. Gehe durch die Markttür zum Einkaufen.',
    chopGreat: 'Perfekter Schnitt! ✨',
    chopMiss: 'Im grünen Bereich tippen!',
    chopReadyPrompt: 'Tippe, wenn du bereit bist!',
    chopActionBtn: (done, total) => `🔪 SCHNEIDEN! (${done}/${total})`,
    saving: 'Speichert...',
    preppedToast: (icon, name) => `${icon} ${name} ist fertig!`,
    missingRawToast: 'Keine rohen Zutaten mehr vorhanden.',

    stoveSelectSub: 'Wähle ein Gericht zum Kochen',
    stoveActiveSub: (name) => `${name} kocht — halte die Hitze im goldenen Bereich!`,
    startCooking: '🔥 Kochen starten',
    prepareIngredients: 'Zutaten fehlen',
    stoveMarketHint:
      'Für fehlende Zutaten gehe durch die linke Tür in den Markt oder schneide Gemüse vor.',
    cookProgressLabel: (icon, name) => `${icon} ${name} Kochfortschritt`,
    stoveHeatLabel: 'Herdhitze',
    heatGolden: '✨ Perfekte Hitze!',
    heatLow: 'Zu kalt',
    heatHigh: 'Zu heiß!',
    holdFlameBtn: 'HITZE GEBEN (Halten)',
    nowActionBtn: (action) => `✨ JETZT ${action.toUpperCase()}! (+18%)`,
    waitingActionBtn: (action) => `Warte auf ${action}...`,
    cookedToast: (icon, name, coins) => `${icon} ${name} ist köstlich geworden! +${coins} Münzen`,
    missingIngredientsToast: 'Zutaten fehlen — Kochen abgebrochen.',

    recipeBookSubtitle: 'Echte Rezepte zum Nachkochen & „In echt gekocht“-Bestätigung',
    inGameCount: (n) => `Im Spiel: ${n}×`,
    irlCount: (n) => `In echt: ${n}×`,
    inGameIngredients: 'Zutaten im Spiel',
    rewardLabel: (coins) => `Belohnung: +🪙 ${coins}`,
    realLifeRecipeTitle: (name) => `Echtes Rezept — ${name}`,
    ingredientsHeading: 'Zutaten',
    stepsHeading: 'Zubereitung',
    chefTipHeading: 'Küchentipp:',
    madeItIrlTitle: 'In echt gekocht!',
    notePlaceholder: 'Kurze Erinnerung (optional)...',
    madeItAgainBtn: 'Nochmal gekocht (+30 🪙)',
    confirmedWaitingPartner: 'Bestätigt ✓ (Warte auf Partner)',
    confirmPartnerBtn: 'Ich bestätige auch (+50 🪙)',
    confirmFirstBtn: 'In echt gekocht! (+30 🪙)',
    bothConfirmedToast: (name) =>
      `🎉 Ihr habt ${name} beide in echt bestätigt! +50 Bonus-Münzen`,
    singleConfirmedToast: (name) =>
      `🍽️ ${name} als „In echt gekocht“ gespeichert! +30 Münzen`,

    partnerJoinedToast: (name) => `${name} ist beigetreten!`,
    partnerLeftToast: (name) => `${name} hat die Küche verlassen.`,

    characters: {
      bubu: { name: 'Bubu', tagline: 'Süßer Panda' },
      dudu: { name: 'Dudu', tagline: 'Kleiner Bär' },
      cat: { name: 'Katze', tagline: 'Tigerkatze' },
      dog: { name: 'Hund', tagline: 'Golden Welpe' },
    },

    ingredients: {
      domates: 'Tomate',
      biber: 'Grüne Paprika',
      yumurta: 'Ei',
      mantar: 'Champignons',
      makarna: 'Pasta',
      krema: 'Sahne',
      cilek: 'Erdbeere',
      un: 'Weizenmehl',
      sut: 'Frische Milch',
      domates_dogranmis: 'Gewürfelte Tomaten',
      biber_dogranmis: 'Geschnittene Paprika',
      mantar_dilim: 'Champignonscheiben',
      cilek_dilim: 'Erdbeerscheiben',
    },

    recipes: {
      menemen: {
        name: 'Menemen',
        tagline: 'Türkischer Frühstücksklassiker — Tomaten & Paprika schneiden und anbraten.',
        cookActionLabel: 'Rühren',
        prepTime: '15 Min.',
        servings: '2 Personen',
        difficulty: 'Einfach',
        ingredients: [
          '3 reife mittelgroße Tomaten (geschält und gewürfelt)',
          '2 grüne Spitzpaprika (fein geschnitten)',
          '3 Eier',
          '2 EL Olivenöl + 1 TL Butter',
          '1 TL Salz, je ½ TL schwarzer Pfeffer & Chiliflocken',
        ],
        steps: [
          'Olivenöl und Butter in einer weiten Pfanne erhitzen und die Paprika 3–4 Minuten weich dünsten.',
          'Tomatenwürfel dazugeben und zugedeckt 6–7 Minuten sanft köcheln lassen.',
          'Mit Salz, Pfeffer und Chiliflocken abschmecken.',
          'Die Eier direkt in die Pfanne schlagen und sanft unterheben, ca. 2 Minuten cremig stocken lassen.',
          'Sofort heiß mit frischem Brot servieren.',
        ],
        chefTip:
          'Erst das Eiweiß leicht stocken lassen und dann das Eigelb vorsichtig einrühren — so wird es herrlich saftig.',
      },
      mantarli_makarna: {
        name: 'Cremige Pilzpasta',
        tagline: 'Samtige Pilz-Sahne-Soße — Champignons schneiden und mit Pasta vermengen.',
        cookActionLabel: 'Schwenken',
        prepTime: '25 Min.',
        servings: '2 Personen',
        difficulty: 'Mittel',
        ingredients: [
          '250 g Penne oder Tagliatelle',
          '250 g frische Champignons (geputzt und in Scheiben)',
          '200 ml Kochsahne',
          '2 Knoblauchzehen (fein gehackt)',
          '1 EL Butter + 1 EL Olivenöl',
          '½ Kelle Pastawasser, Salz, frisch gemahlener Pfeffer, optional Parmesan',
        ],
        steps: [
          'Pasta in reichlich Salzwasser 1 Minute kürzer als angegeben (al dente) kochen; ½ Kelle Kochwasser aufheben.',
          'Butter und Öl stark erhitzen und Champignons goldbraun anbraten.',
          'Knoblauch 30 Sekunden mitbraten, dann mit Sahne ablöschen und 3 Minuten sanft einkochen.',
          'Pasta und etwas Pastawasser in die Pfanne geben und 1–2 Minuten cremig schwenken.',
          'Mit Pfeffer und Parmesan direkt servieren.',
        ],
        chefTip:
          'Champignons nicht waschen, sondern trocken abreiben und heiß anbraten — so bräunen sie aromatisch statt zu verwässern.',
      },
      pankek: {
        name: 'Erdbeer-Pancakes',
        tagline: 'Fluffige süße Pause — Erdbeeren schneiden und Pancakes goldbraun wenden.',
        cookActionLabel: 'Wenden',
        prepTime: '20 Min.',
        servings: '2 Personen',
        difficulty: 'Einfach',
        ingredients: [
          '150 g Weizenmehl',
          '200 ml Milch',
          '1 Ei',
          '2 EL Zucker + 1 Pck. Vanillezucker + 1 TL Backpulver',
          '1 EL neutrales Öl + 1 Schale geschnittene Erdbeeren',
        ],
        steps: [
          'Ei und Zucker schaumig schlagen; Milch und Öl einrühren.',
          'Mehl, Backpulver und Vanillezucker dazugeben und zu einem glatten Teig verrühren.',
          'Beschichtete Pfanne leicht einfetten und bei mittlerer Hitze kleine Teigkreise ausbacken.',
          'Sobald Bläschen an der Oberfläche erscheinen, wenden und 1 weitere Minute goldbraun backen.',
          'Mit frischen Erdbeerscheiben und Honig oder Ahornsirup stapeln und genießen.',
        ],
        chefTip:
          'Den Teig nur kurz verrühren und 5 Minuten ruhen lassen — das macht die Pancakes besonders luftig.',
      },
    },
  },
};

export function getTranslations(lang: Language): TranslationBundle {
  return TRANSLATIONS[lang];
}
