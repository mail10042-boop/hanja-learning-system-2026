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

export function extractBaseLevel(label?: string | null): string {
  if (!label || typeof label !== 'string') {
    return '8급';
  }
  const match = label.match(/^(특급|준[1-6]급|[1-8]급)/);
  return match ? match[1] : label;
}

export function sortHanjaLevels(levels?: (string | null | undefined)[] | null): string[] {
  if (!levels || !Array.isArray(levels)) {
    return [];
  }
  const safeList = levels.filter((lvl): lvl is string => typeof lvl === 'string' && lvl.trim().length > 0);
  return [...safeList].sort((a, b) => {
    const baseA = extractBaseLevel(a);
    const baseB = extractBaseLevel(b);
    const rankA = HANJA_LEVEL_RANKS[baseA] ?? 99;
    const rankB = HANJA_LEVEL_RANKS[baseB] ?? 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return (a || '').localeCompare(b || '', 'ko');
  });
}

export function sortSectionRowItems(items?: (SectionRowItem | null | undefined)[] | null): SectionRowItem[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  const safeList = items.filter((item): item is SectionRowItem => item !== null && item !== undefined);
  return [...safeList].sort((a, b) => {
    const labelA = a?.levelLabel || a?.baseLevel || '';
    const labelB = b?.levelLabel || b?.baseLevel || '';
    const baseA = extractBaseLevel(labelA);
    const baseB = extractBaseLevel(labelB);
    const rankA = HANJA_LEVEL_RANKS[baseA] ?? 99;
    const rankB = HANJA_LEVEL_RANKS[baseB] ?? 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return labelA.localeCompare(labelB, 'ko');
  });
}

export function sortRangesByPage(ranges?: (string | null | undefined)[] | null): string[] {
  if (!ranges || !Array.isArray(ranges)) {
    return [];
  }
  const safeList = ranges.filter((r): r is string => typeof r === 'string');
  return [...safeList].sort((a, b) => {
    const matchA = (a || '').match(/(\d+)/);
    const matchB = (b || '').match(/(\d+)/);
    const numA = matchA ? parseInt(matchA[1], 10) : 999;
    const numB = matchB ? parseInt(matchB[1], 10) : 999;
    if (numA !== numB) return numA - numB;
    return (a || '').localeCompare(b || '', 'ko');
  });
}
