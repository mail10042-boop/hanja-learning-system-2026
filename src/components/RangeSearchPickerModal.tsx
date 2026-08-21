import React, { useState, useMemo } from 'react';
import { Search, Filter, BookOpen, X, Hash } from 'lucide-react';
import { extractPageOrNumber } from '../utils/sorter';

interface RangeSearchPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  baseLevel: string;
  availableRanges?: string[];
  currentSelectedRange?: string;
  currentRange?: string;
  onSelectRange: (range: string) => void;
  bankProblems?: Record<string, { prob1?: string; prob2?: string; prob3?: string; prob4?: string }>;
}

type FilterCategory = 'all' | 'lesson' | 'page' | 'other';
type SortMode = 'custom' | 'page' | 'name';

export const RangeSearchPickerModal: React.FC<RangeSearchPickerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  baseLevel,
  availableRanges,
  currentSelectedRange,
  currentRange,
  onSelectRange,
  bankProblems,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<SortMode>('custom');

  if (!isOpen) return null;

  // Selected range identifier
  const activeSelected = currentSelectedRange || currentRange;

  // Derive ranges from availableRanges or keys of bankProblems
  const rangesList = useMemo(() => {
    if (availableRanges && availableRanges.length > 0) return availableRanges;
    if (bankProblems) return Object.keys(bankProblems);
    return [];
  }, [availableRanges, bankProblems]);

  // Classify each range with original index preserved
  const categorizedRanges = useMemo(() => {
    return rangesList.map((rng, index) => {
      const pageNum = extractPageOrNumber(rng);
      const isLesson = /(?:과|단원|장|주차)/i.test(rng);
      const isPage = /(?:p|페이지|쪽)/i.test(rng);

      let cat: FilterCategory = 'other';
      if (isLesson) cat = 'lesson';
      else if (isPage) cat = 'page';

      return {
        name: rng,
        num: pageNum,
        index,
        category: cat,
        problems: bankProblems?.[rng],
      };
    });
  }, [rangesList, bankProblems]);

  // Filter and search
  const filteredRanges = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return categorizedRanges
      .filter((item) => {
        // Category filter
        if (categoryFilter === 'lesson' && item.category !== 'lesson') return false;
        if (categoryFilter === 'page' && item.category !== 'page') return false;
        if (categoryFilter === 'other' && (item.category === 'lesson' || item.category === 'page')) return false;

        // Search term filter (searches range name and problem text if exists)
        if (!term) return true;

        const nameMatch = item.name.toLowerCase().includes(term);
        const p1 = item.problems?.prob1?.toLowerCase().includes(term);
        const p2 = item.problems?.prob2?.toLowerCase().includes(term);
        const p3 = item.problems?.prob3?.toLowerCase().includes(term);
        const p4 = item.problems?.prob4?.toLowerCase().includes(term);

        return nameMatch || p1 || p2 || p3 || p4;
      })
      .sort((a, b) => {
        if (sortBy === 'custom') {
          return a.index - b.index;
        }
        if (sortBy === 'page') {
          if (a.num !== b.num) return a.num - b.num;
          return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
        }
        return a.name.localeCompare(b.name, 'ko-KR', { numeric: true });
      });
  }, [categorizedRanges, searchTerm, categoryFilter, sortBy]);

  // Quick unit/page quick jump chips
  const quickJumpChips = useMemo(() => {
    // Extract unique units or page clusters
    const units = [
      { label: '전체', filter: '' },
      { label: '1~5과', filter: '1과|2과|3과|4과|5과' },
      { label: '6~10과', filter: '6과|7과|8과|9과|10과' },
      { label: '11~15과', filter: '11과|12과|13과|14과|15과' },
      { label: '16~20과', filter: '16과|17과|18과|19과|20과' },
      { label: '100p대', filter: '1' },
      { label: '200p대', filter: '2' },
    ];
    return units;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-black text-xs">
                {baseLevel}
              </span>
              <h3 className="text-base font-bold">{title}</h3>
            </div>
            {subtitle && <p className="text-xs text-slate-300">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Toolbars */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="페이지(예: 165p, 25쪽)나 과(예: 3과, 10과), 또는 한자명으로 검색..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills & Quick Jumps */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Category tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                전체 ({categorizedRanges.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('lesson')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  categoryFilter === 'lesson'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📖 과/단원별
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('page')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  categoryFilter === 'page'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📄 페이지별
              </button>
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-400 font-semibold px-1 text-[11px]">정렬:</span>
              <button
                type="button"
                onClick={() => setSortBy('custom')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  sortBy === 'custom'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="문제은행에서 설정한 사용자 지정 순서로 표시"
              >
                🎯 지정 순서
              </button>
              <button
                type="button"
                onClick={() => setSortBy('page')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  sortBy === 'page'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="과 및 페이지 번호 오름차순으로 자동 정렬"
              >
                🔢 페이지순
              </button>
              <button
                type="button"
                onClick={() => setSortBy('name')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer text-xs ${
                  sortBy === 'name'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="가나다 알파벳순 정렬"
              >
                🔤 가나다순
              </button>
            </div>
          </div>
        </div>

        {/* Range List Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {filteredRanges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredRanges.map((item) => {
                const isSelected = activeSelected === item.name;
                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      onSelectRange(item.name);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer text-left flex flex-col justify-between space-y-1.5 hover:scale-[1.01] active:scale-[0.99] ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-400/30'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-[10px] shrink-0">
                          선택됨
                        </span>
                      )}
                    </div>

                    {/* Preview of Problems if available */}
                    {item.problems && (
                      <div className="text-[11px] text-slate-500 bg-slate-50/80 p-1.5 rounded-lg border border-slate-100 space-y-0.5">
                        {item.problems.prob1 && (
                          <div className="truncate">
                            <span className="font-semibold text-blue-700">1:</span> {item.problems.prob1}
                          </div>
                        )}
                        {item.problems.prob2 && (
                          <div className="truncate">
                            <span className="font-semibold text-blue-700">2:</span> {item.problems.prob2}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="text-sm font-bold text-slate-600">검색된 문제 범위가 없습니다.</p>
              <p className="text-xs">
                [{baseLevel}] 문제은행에 해당 과나 페이지가 등록되어 있는지 확인해주세요.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            총 <strong className="text-slate-800">{filteredRanges.length}개</strong> 범위 표시 중
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
