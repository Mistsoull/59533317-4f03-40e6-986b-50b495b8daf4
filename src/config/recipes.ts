export type RecipeId = 'menemen' | 'mantarli_makarna' | 'pankek';

export interface RecipeRequirement {
  itemId: string;
  qty: number;
}

export interface RealLifeRecipe {
  prepTime: string;
  servings: string;
  difficulty: 'Kolay' | 'Orta';
  ingredients: readonly string[];
  steps: readonly string[];
  chefTip: string;
}

export interface RecipeDef {
  id: RecipeId;
  name: string;
  icon: string;
  tagline: string;
  rewardCoins: number;
  cookStyle: 'stir' | 'simmer' | 'flip';
  cookActionLabel: string;
  requirements: readonly RecipeRequirement[];
  irl: RealLifeRecipe;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  menemen: {
    id: 'menemen',
    name: 'Menemen',
    icon: '🍳',
    tagline: 'Sıcak kahvaltı klasiği — domates ve biberi doğra, ocakta harmanla.',
    rewardCoins: 65,
    cookStyle: 'stir',
    cookActionLabel: 'Karıştır',
    requirements: [
      { itemId: 'domates_dogranmis', qty: 1 },
      { itemId: 'biber_dogranmis', qty: 1 },
      { itemId: 'yumurta', qty: 1 },
    ],
    irl: {
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
      chefTip: 'Yumurtayı tamamen çırpmadan beyazları hafif pişince sarıları dağıtırsanız lokanta kıvamı yakalarsınız.',
    },
  },
  mantarli_makarna: {
    id: 'mantarli_makarna',
    name: 'Kremalı Mantarlı Makarna',
    icon: '🍝',
    tagline: 'İpeksi mantar soslu akşam yemeği — mantarı dilimle, krema ile bağla.',
    rewardCoins: 90,
    cookStyle: 'simmer',
    cookActionLabel: 'Harmanla',
    requirements: [
      { itemId: 'mantar_dilim', qty: 1 },
      { itemId: 'makarna', qty: 1 },
      { itemId: 'krema', qty: 1 },
    ],
    irl: {
      prepTime: '25 dk',
      servings: '2 kişilik',
      difficulty: 'Orta',
      ingredients: [
        '250 g penne veya tagliatelle makarna',
        '250 g kültür mantarı (nemli bezle silinip dilimlenmiş)',
        '200 ml sıvı krema',
        '2 diş ince doğranmış sarımsak',
        '1 yemek kaşığı tereyağı + 1 yemek kaşığı zeytinyağı',
        'Yarım kepçe makarna haşlama suyu, tuz, taze çekilmiş karabiber, isteğe bağlı parmesan',
      ],
      steps: [
        'Makarnayı bol tuzlu kaynar suda paketteki süreden 1 dakika eksik (al dente) haşlayın; yarım kepçe suyunu ayırın.',
        'Geniş tavada yağları kızdırıp dilimlenmiş mantarları yüksek ateşte altın rengi alana kadar soteleyin.',
        'Sarımsakları ekleyip 30 saniye kokusu çıkana kadar çevirin, ardından kremayı döküp kısık ateşte 3 dakika kaynatın.',
        'Haşlanan makarnayı ve ayırdığınız makarna suyunu tavaya ekleyip sos makarnaya yapışana kadar 1-2 dakika harmanlayın.',
        'Taze karabiber ve parmesan ile hemen servis edin.',
      ],
      chefTip: 'Mantarları yıkamak yerine nemli bezle silip yüksek ateşte sotelemek suyunu salmadan karamelize olmasını sağlar.',
    },
  },
  pankek: {
    id: 'pankek',
    name: 'Çilekli Pankek',
    icon: '🥞',
    tagline: 'Yumuşacık tatlı mola — çilekleri dilimle, tavada altın gibi çevir.',
    rewardCoins: 95,
    cookStyle: 'flip',
    cookActionLabel: 'Çevir',
    requirements: [
      { itemId: 'cilek_dilim', qty: 1 },
      { itemId: 'un', qty: 1 },
      { itemId: 'sut', qty: 1 },
      { itemId: 'yumurta', qty: 1 },
    ],
    irl: {
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
        'Dilimlenmiş çilekler ve bal/akçaağaç şurubu ile üst üste dizip servis edin.',
      ],
      chefTip: 'Hamuru fazla çırpmayıp 5 dakika dinlendirirseniz pankekler çok daha kabarık ve süngerimsi olur.',
    },
  },
};

export const RECIPE_LIST: readonly RecipeDef[] = [
  RECIPES.menemen,
  RECIPES.mantarli_makarna,
  RECIPES.pankek,
];
