/**
 * Extracts page or unit numbers from range string (e.g. "165p", "165페이지", "10쪽", "3과")
 * for automatic pedagogical order sorting.
 */
export function extractPageOrNumber(str: string): number {
  if (!str) return 999999;

  // 1. Explicit page indicators like "165p", "165페이지", "165쪽", "p.165", "p 165"
  const pMatch = str.match(/p(?:age)?\.?\s*(\d+)/i) || str.match(/(\d+)\s*(?:p|페이지|쪽)/i);
  if (pMatch) {
    return parseInt(pMatch[1], 10);
  }

  // 2. Unit or lesson indicators like "1과", "2단원", "3장"
  const unitMatch = str.match(/(\d+)\s*(?:과|단원|장|주차)/i);
  if (unitMatch) {
    return parseInt(unitMatch[1], 10);
  }

  // 3. Fallback: Any leading or enclosed number
  const genericMatch = str.match(/\d+/);
  if (genericMatch) {
    return parseInt(genericMatch[0], 10);
  }

  return 999999;
}

/**
 * Sorts range names in natural ascending order by page number and lesson unit.
 */
export function sortRangesByPage(ranges: string[]): string[] {
  return [...ranges].sort((a, b) => {
    const numA = extractPageOrNumber(a);
    const numB = extractPageOrNumber(b);

    if (numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b, 'ko-KR', { numeric: true });
  });
}
