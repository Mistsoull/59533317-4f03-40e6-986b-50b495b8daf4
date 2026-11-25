export type CharacterId = 'cat' | 'dog' | 'bubu' | 'dudu';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  tagline: string;
  accentColor: string;
  badgeBg: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  bubu: {
    id: 'bubu',
    name: 'Bubu',
    emoji: '🐼',
    tagline: 'Minnoş Panda',
    accentColor: '#e86f6d',
    badgeBg: '#ffe6e6',
  },
  dudu: {
    id: 'dudu',
    name: 'Dudu',
    emoji: '🐻',
    tagline: 'Sıcak Ayıcık',
    accentColor: '#9c6644',
    badgeBg: '#f5e6d8',
  },
  cat: {
    id: 'cat',
    name: 'Kedi',
    emoji: '🐱',
    tagline: 'Tatlı Tekir',
    accentColor: '#e78a3e',
    badgeBg: '#fff0db',
  },
  dog: {
    id: 'dog',
    name: 'Köpek',
    emoji: '🐶',
    tagline: 'Neşeli Golden',
    accentColor: '#3d9970',
    badgeBg: '#e2f7ec',
  },
};

export const CHARACTER_LIST: readonly CharacterDef[] = [
  CHARACTERS.bubu,
  CHARACTERS.dudu,
  CHARACTERS.cat,
  CHARACTERS.dog,
];
