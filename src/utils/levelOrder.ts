import { SectionRowItem } from '../types';

// Natural Hanja Grade Rank: Lowest to Highest
export const HANJA_LEVEL_RANKS: Record<string, number> = {
  '8급': 1,
  '7급': 2,
  '준6급': 3,
  '6급': 4,
  '준5급': 5,
  '5급': 6,
  '준4급': 7,
  '4급': 8,
  '준3급': 9,
  '3급': 10,
  '준2급': 11,
  '2급': 12,
  '준1급': 13,
  '1급': 14,
  '특급': 15,
};

export function extractBaseLevel(label: string): string {
  const match = label.match(/^(특급|준[1-6]급|[1-8]급)/);
  return match ? match[1] : label;
}

export function sortHanjaLevels(levels: string[]): string[] {
  return [...levels].sort((a, b) => {
    const baseA = extractBaseLevel(a);
    const baseB = extractBaseLevel(b);
    const rankA = HANJA_LEVEL_RANKS[baseA] ?? 99;
    const rankB = HANJA_LEVEL_RANKS[baseB] ?? 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.localeCompare(b, 'ko');
  });
}

export function sortSectionRowItems(items: SectionRowItem[]): SectionRowItem[] {
  return [...items].sort((a, b) => {
    const baseA = extractBaseLevel(a.levelLabel);
    const baseB = extractBaseLevel(b.levelLabel);
    const rankA = HANJA_LEVEL_RANKS[baseA] ?? 99;
    const rankB = HANJA_LEVEL_RANKS[baseB] ?? 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.levelLabel.localeCompare(b.levelLabel, 'ko');
  });
}
