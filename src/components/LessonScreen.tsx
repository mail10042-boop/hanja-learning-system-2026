import React, { useState } from 'react';
import {
  EyeOff,
  RefreshCw,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Maximize2,
  Columns,
  Rows,
} from 'lucide-react';
import { AppState, SectionItem, SectionRowItem } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { playBeep } from '../utils/audio';
import { extractBaseLevel } from '../utils/levelOrder';
import { getOrderedBankRanges } from '../utils/sorter';

interface LessonScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onToggleLevelHide: (level: string) => void;
  onRestoreAllLevels: () => void;
}

const COMMON_PRESET_BUTTONS = [
  '8급',
  '7급',
  '준6급',
  '6급',
  '준5급 0',
  '준5급 1',
  '준5급',
  '5급',
  '준4급 0',
  '준4급 1',
  '준4급',
  '4급',
  '준3급',
  '3급',
  '2급',
];

export const LessonScreen: React.FC<LessonScreenProps> = ({
  state,
  onUpdateState,
  onToggleLevelHide,
  onRestoreAllLevels,
}) => {
  // Active problem tab: 1, 2, 3, 4
  const [selectedProbNum, setSelectedProbNum] = useState<1 | 2 | 3 | 4>(1);

  // Layout view modes
  // Default to 'ranges' or 'both'
  const [displayMode, setDisplayMode] = useState<'ranges' | 'both' | 'problems'>('ranges');
  
  // Section arrangement: 'columns' (섹션 A,B,C 나란히 한 화면에) vs 'stacked' (상하로 넓게)
  const [sectionLayout, setSectionLayout] = useState<'columns' | 'stacked'>('columns');
  
  // Font scale: 'standard' | 'large' | 'huge'
  const [fontSizeScale, setFontSizeScale] = useState<'standard' | 'large' | 'huge'>('large');

  // Focus Modal for single-grade fullscreen classroom projection
  const [focusModalItem, setFocusModalItem] = useState<{ item: SectionRowItem; secName: string } | null>(null);

  // Active dynamic sections list with safe fallback
  const activeSections: SectionItem[] =
    state.sections && state.sections.length > 0 ? state.sections : INITIAL_STATE.sections;

  // Problem source section
  const [problemSectionId, setProblemSectionId] = useState<string>(
    activeSections.find((s) => s.role === 'today')?.id || activeSections[0]?.id || 'sec_1'
  );

  // Section renaming state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');

  // Individual item progress range inline editing state
  const [editingRangeItemKey, setEditingRangeItemKey] = useState<string | null>(null);
  const [editingRangeValue, setEditingRangeValue] = useState<string>('');

  // Add Item to Section popover or toggle
  const [openAddBoxSecId, setOpenAddBoxSecId] = useState<string | null>(null);
  const [customAddInput, setCustomAddInput] = useState<string>('');

  // Update range for a single item in a specific section
  const handleSaveItemRange = (secId: string, rowId: string, newRange: string) => {
    const trimmed = newRange.trim();
    if (!trimmed) {
      setEditingRangeItemKey(null);
      return;
    }
    playBeep(state.soundEnabled, 650, 0.05);
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => (r.id === rowId ? { ...r, rangeName: trimmed } : r)),
          };
        }
        return sec;
      });
      return {
        ...prev,
        sections: nextSections,
      };
    });
    setEditingRangeItemKey(null);
  };

  // Add new section
  const handleAddSection = () => {
    playBeep(state.soundEnabled, 800, 0.08);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nextLetter = alphabet[activeSections.length] || `${activeSections.length + 1}`;
    const newId = `sec_${Date.now()}`;
    const newName = `섹션 ${nextLetter}`;

    const newSectionItem: SectionItem = {
      id: newId,
      name: newName,
      role: 'custom',
      items: [
        { id: `row_${newId}_1`, levelLabel: '8급', rangeName: '1과 (10p)' },
        { id: `row_${newId}_2`, levelLabel: '7급', rangeName: '2과 (25p)' },
        { id: `row_${newId}_3`, levelLabel: '준5급 0', rangeName: '8과 (140p)' },
      ],
    };

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: [...currentSections, newSectionItem],
      };
    });
  };

  // Delete section
  const handleDeleteSection = (secId: string) => {
    if (activeSections.length <= 1) return;

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.filter((s) => s.id !== secId),
      };
    });

    if (problemSectionId === secId) {
      const fallback = activeSections.find((s) => s.id !== secId)?.id || activeSections[0]?.id;
      setProblemSectionId(fallback);
    }
  };

  // Cycle role for a specific section
  const cycleSectionRole = (secId: string) => {
    playBeep(state.soundEnabled, 600, 0.06);
    const ROLES: { role: string; label: string }[] = [
      { role: 'prev', label: '저번 진도' },
      { role: 'today', label: '오늘 진도' },
      { role: 'next', label: '다음 진도' },
      { role: 'review', label: '복습·심화' },
      { role: 'homework', label: '과제' },
      { role: 'custom', label: '자유 진도' },
    ];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((s) => {
        if (s.id === secId) {
          const currentIdx = ROLES.findIndex((r) => r.role === s.role);
          const nextIdx = (currentIdx + 1) % ROLES.length;
          return { ...s, role: ROLES[nextIdx].role };
        }
        return s;
      });

      return { ...prev, sections: nextSections };
    });
  };

  // Save renamed section
  const handleSaveRename = (secId: string) => {
    const trimmed = editTitleInput.trim();
    if (!trimmed) {
      setEditingSectionId(null);
      return;
    }
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => (s.id === secId ? { ...s, name: trimmed } : s)),
      };
    });
    setEditingSectionId(null);
  };

  // Delete row item from section
  const handleDeleteItemFromSection = (secId: string, rowId: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((sec) => {
          if (sec.id === secId) {
            return {
              ...sec,
              items: (sec.items || []).filter((r) => r.id !== rowId),
            };
          }
          return sec;
        }),
      };
    });
  };

  // Add new row item (level) to section
  const handleAddItemToSection = (secId: string, levelLabel: string) => {
    const label = levelLabel.trim();
    if (!label) return;

    playBeep(state.soundEnabled, 750, 0.06);
    const base = extractBaseLevel(label);
    const availableRanges = getOrderedBankRanges(state.bank, state.bankRangeOrder, base);
    const defaultRange = availableRanges.length > 0 ? availableRanges[0] : `${label} 1과 (10p)`;

    const newRow: SectionRowItem = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      levelLabel: label,
      baseLevel: base,
      rangeName: defaultRange,
    };

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((sec) => {
          if (sec.id === secId) {
            return {
              ...sec,
              items: [...(sec.items || []), newRow],
            };
          }
          return sec;
        }),
      };
    });

    setCustomAddInput('');
  };

  // Get sticker styling
  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'prev':
        return {
          label: '저번 시간',
          color: 'bg-slate-700 text-white border-slate-800',
          dot: 'bg-slate-300',
        };
      case 'today':
        return {
          label: '오늘 배울 한자',
          color: 'bg-blue-600 text-white border-blue-700 shadow-2xs ring-1 ring-blue-300',
          dot: 'bg-white',
        };
      case 'next':
        return {
          label: '다음 시간',
          color: 'bg-emerald-600 text-white border-emerald-700',
          dot: 'bg-white',
        };
      case 'review':
        return {
          label: '복습·심화',
          color: 'bg-indigo-600 text-white border-indigo-700',
          dot: 'bg-white',
        };
      case 'homework':
        return {
          label: '과제 진도',
          color: 'bg-purple-600 text-white border-purple-700',
          dot: 'bg-white',
        };
      default:
        return {
          label: '자유 진도',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
        };
    }
  };

  // Helper to extract problem text for a row item
  const getProblemTextForRow = (row: SectionRowItem, probNum: 1 | 2 | 3 | 4): string => {
    const customKey = `customProb${probNum}` as keyof SectionRowItem;
    if (typeof row[customKey] === 'string' && (row[customKey] as string).trim()) {
      return (row[customKey] as string).trim();
    }

    const baseLvl = row.baseLevel || extractBaseLevel(row.levelLabel);
    const rangeData = state.bank[baseLvl]?.[row.rangeName];
    if (rangeData) {
      const probKey = `prob${probNum}` as keyof typeof rangeData;
      const txt = rangeData[probKey];
      if (typeof txt === 'string' && txt.trim()) return txt.trim();
    }

    const directRangeData = state.bank[row.levelLabel]?.[row.rangeName];
    if (directRangeData) {
      const probKey = `prob${probNum}` as keyof typeof directRangeData;
      const txt = directRangeData[probKey];
      if (typeof txt === 'string' && txt.trim()) return txt.trim();
    }

    return '';
  };

  // Typography font size classes for Range and Problem texts
  // Crucial: No truncation! Full word-wrapping and crystal clear visibility!
  const getRangeTextClass = () => {
    switch (fontSizeScale) {
      case 'standard':
        return 'text-sm sm:text-base font-extrabold';
      case 'large':
        return 'text-base sm:text-lg md:text-xl font-black';
      case 'huge':
        return 'text-lg sm:text-xl md:text-2xl font-black';
    }
  };

  const getProblemTextClass = () => {
    switch (fontSizeScale) {
      case 'standard':
        return 'text-lg sm:text-xl md:text-2xl font-black';
      case 'large':
        return 'text-xl sm:text-2xl md:text-3xl font-black';
      case 'huge':
        return 'text-2xl sm:text-3xl md:text-4xl font-black';
    }
  };

  // Find target section for problem section
  const currentProblemSection = activeSections.find((s) => s.id === problemSectionId) || activeSections[0];
  const problemItems = (currentProblemSection?.items || []).filter(
    (item) =>
      !state.hiddenLevels.includes(item.levelLabel) &&
      !state.hiddenLevels.includes(extractBaseLevel(item.levelLabel))
  );

  return (
    <div id="screen-lesson" className="space-y-3.5 max-w-full">
      {/* 1. SLIM & SMART CLASSROOM TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: View Mode Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-slate-500 mr-1 hidden sm:inline">화면:</span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg font-bold text-slate-700">
            <button
              type="button"
              onClick={() => setDisplayMode('ranges')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'ranges'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
            >
              공부 범위 전체보기
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('both')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'both'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
            >
              범위 + 문제 함께
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('problems')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'problems'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
            >
              확인 문제만
            </button>
          </div>
        </div>

        {/* Center/Right: Section Layout & Font Size */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section Layout Switch (섹션 A, B, C 나란히 보기 vs 세로 펼치기) */}
          {(displayMode === 'ranges' || displayMode === 'both') && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setSectionLayout('columns')}
                className={`px-2.5 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  sectionLayout === 'columns'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'hover:bg-slate-200'
                }`}
                title="섹션 A, B, C를 좌우 열로 나란히 배치하여 한 화면에 모두 보이게 합니다"
              >
                <Columns className="w-3 h-3" />
                <span>섹션 나란히(한 화면)</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionLayout('stacked')}
                className={`px-2.5 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  sectionLayout === 'stacked'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'hover:bg-slate-200'
                }`}
                title="섹션들을 위아래로 넓게 펼칩니다"
              >
                <Rows className="w-3 h-3" />
                <span>세로 펼침</span>
              </button>
            </div>
          )}

          {/* Add Section Button */}
          <button
            type="button"
            onClick={handleAddSection}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ 새 섹션</span>
          </button>

          {/* Font Scale */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg font-bold text-slate-700">
            <span className="px-1.5 text-slate-400 font-semibold hidden md:inline">글자:</span>
            <button
              type="button"
              onClick={() => setFontSizeScale('standard')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                fontSizeScale === 'standard' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'hover:bg-slate-200'
              }`}
            >
              표준
            </button>
            <button
              type="button"
              onClick={() => setFontSizeScale('large')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                fontSizeScale === 'large' ? 'bg-blue-600 text-white shadow-2xs font-black' : 'hover:bg-slate-200'
              }`}
            >
              크게(권장)
            </button>
            <button
              type="button"
              onClick={() => setFontSizeScale('huge')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                fontSizeScale === 'huge' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'hover:bg-slate-200'
              }`}
            >
              특대
            </button>
          </div>
        </div>
      </div>

      {/* Hidden levels notice banner */}
      {state.hiddenLevels.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-800 font-medium flex-wrap">
            <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-bold">숨겨진 급수:</span>
            {state.hiddenLevels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onToggleLevelHide(lvl)}
                className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 transition cursor-pointer flex items-center gap-1 text-[11px]"
                title="클릭하여 다시 보이기"
              >
                <span>{lvl}</span>
                <span className="text-amber-500 hover:text-amber-700">✕</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRestoreAllLevels}
            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>전체 보이기</span>
          </button>
        </div>
      )}

      {/* 2. STUDY RANGE SECTION (공부하는 범위 - 섹션 A, B, C 한 화면 완전 표시 & 절대 생략 없음) */}
      {(displayMode === 'ranges' || displayMode === 'both') && (
        <div
          className={
            sectionLayout === 'columns' && activeSections.length > 1
              ? `grid gap-3 ${
                  activeSections.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : activeSections.length === 3
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                }`
              : 'space-y-3'
          }
        >
          {activeSections.map((sec) => {
            const roleBadge = getRoleBadge(sec.role);
            const isAddBoxOpen = openAddBoxSecId === sec.id;
            const isEditingThisTitle = editingSectionId === sec.id;

            const visibleItems = (sec.items || []).filter(
              (item) =>
                !state.hiddenLevels.includes(item.levelLabel) &&
                !state.hiddenLevels.includes(extractBaseLevel(item.levelLabel))
            );

            return (
              <section
                key={sec.id}
                className={`bg-white rounded-xl border transition shadow-2xs overflow-hidden flex flex-col ${
                  sec.role === 'today'
                    ? 'border-blue-300 ring-2 ring-blue-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Section Card Header */}
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/90 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isEditingThisTitle ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          className="px-2 py-0.5 text-xs font-bold rounded border border-blue-400 bg-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(sec.id);
                            if (e.key === 'Escape') setEditingSectionId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(sec.id)}
                          className="p-1 rounded bg-emerald-600 text-white cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSectionId(null)}
                          className="p-1 rounded bg-slate-200 text-slate-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-black text-slate-900 tracking-tight">
                          {sec.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectionId(sec.id);
                            setEditTitleInput(sec.name);
                          }}
                          className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                          title="섹션 이름 수정"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Progress Sticker */}
                    <button
                      type="button"
                      onClick={() => cycleSectionRole(sec.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${roleBadge.color}`}
                      title="클릭하여 진도 구분(오늘/저번/다음 등) 변경"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot} animate-pulse`}></span>
                      <span>{roleBadge.label}</span>
                    </button>
                  </div>

                  {/* Right Header Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenAddBoxSecId(isAddBoxOpen ? null : sec.id)}
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition ${
                        isAddBoxOpen
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>급수 추가</span>
                    </button>

                    {activeSections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                        title="이 섹션 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Add Level Drawer */}
                {isAddBoxOpen && (
                  <div className="bg-blue-50/90 px-3 py-2 border-b border-blue-200 space-y-1.5 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {COMMON_PRESET_BUTTONS.map((btnLabel) => (
                        <button
                          key={btnLabel}
                          type="button"
                          onClick={() => handleAddItemToSection(sec.id, btnLabel)}
                          className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:bg-blue-600 hover:text-white text-slate-800 font-bold text-[11px] transition cursor-pointer"
                        >
                          +{btnLabel}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={customAddInput}
                        onChange={(e) => setCustomAddInput(e.target.value)}
                        placeholder="직접 입력 (예: 준5급 1)..."
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItemToSection(sec.id, customAddInput)}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItemToSection(sec.id, customAddInput)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                )}

                {/* Grade & Study Ranges List: NO TRUNCATION EVER, 100% VISIBLE */}
                <div className="p-2 sm:p-2.5 flex-1 space-y-1.5">
                  {visibleItems.length > 0 ? (
                    visibleItems.map((item) => {
                      const itemKey = `${sec.id}_${item.id}`;
                      const isEditingRange = editingRangeItemKey === itemKey;
                      const baseLvl = item.baseLevel || extractBaseLevel(item.levelLabel);
                      const bankRanges = getOrderedBankRanges(state.bank, state.bankRangeOrder, baseLvl);

                      return (
                        <div
                          key={item.id}
                          className={`relative group rounded-xl border transition flex items-center px-2.5 py-1.5 sm:py-2 gap-2 shadow-2xs ${
                            isEditingRange
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                              : 'border-slate-200/90 bg-slate-50/90 hover:bg-white hover:border-blue-300'
                          }`}
                        >
                          {/* Grade Badge with Tiny Integrated Hide Button */}
                          <div className="relative shrink-0 flex flex-col items-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs sm:text-sm md:text-base min-w-[54px] sm:min-w-[60px] text-center tracking-tight shadow-2xs">
                              {item.levelLabel}
                            </span>

                            {/* Small Hide Button at Badge Corner */}
                            <button
                              type="button"
                              onClick={() => onToggleLevelHide(item.levelLabel)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-200 hover:bg-amber-500 hover:text-white text-slate-600 flex items-center justify-center text-[9px] font-bold shadow-2xs transition cursor-pointer opacity-70 group-hover:opacity-100"
                              title={`${item.levelLabel} 화면에서 숨기기`}
                            >
                              <EyeOff className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          {/* Complete Study Range Text - FULLY VISIBLE, NEVER CLIPPED */}
                          {isEditingRange ? (
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingRangeValue}
                                  onChange={(e) => setEditingRangeValue(e.target.value)}
                                  placeholder="공부 범위 입력..."
                                  className="flex-1 px-2 py-1 text-xs sm:text-sm font-black rounded-lg border border-blue-400 bg-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveItemRange(sec.id, item.id, editingRangeValue);
                                    if (e.key === 'Escape') setEditingRangeItemKey(null);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveItemRange(sec.id, item.id, editingRangeValue)}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shrink-0"
                                  title="저장"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRangeItemKey(null)}
                                  className="p-1.5 rounded-lg bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                                  title="취소"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {bankRanges.length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) setEditingRangeValue(e.target.value);
                                  }}
                                  defaultValue=""
                                  className="w-full px-1.5 py-0.5 text-[11px] font-bold rounded border border-slate-300 bg-white text-slate-800"
                                >
                                  <option value="" disabled>
                                    문제은행 등록 범위 빠른 선택...
                                  </option>
                                  {bankRanges.map((br) => (
                                    <option key={br} value={br}>
                                      {br}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingRangeItemKey(itemKey);
                                setEditingRangeValue(item.rangeName || '');
                              }}
                              className="flex-1 min-w-0 cursor-pointer py-0.5 px-1"
                              title="클릭하여 공부하는 범위 수정"
                            >
                              {/* STRICTLY NO TRUNCATE: Word-wrapped and 100% complete text */}
                              <p
                                className={`${getRangeTextClass()} text-slate-950 tracking-tight leading-snug break-keep whitespace-normal group-hover:text-blue-700 transition`}
                              >
                                {item.rangeName || '(클릭하여 범위 입력)'}
                              </p>
                            </div>
                          )}

                          {/* Subtle Delete icon on hover */}
                          {!isEditingRange && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItemFromSection(sec.id, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer shrink-0"
                              title="이 급수 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-3 text-xs font-semibold text-slate-400">
                      급수가 없습니다. [+ 급수 추가]를 누르세요.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 3. PROBLEM PRACTICE SECTION (수업 확인 문제) */}
      {(displayMode === 'problems' || displayMode === 'both') && (
        <section className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                수업 확인 문제
              </h3>
            </div>

            {/* Problem 1, 2, 3, 4 Pill Selectors */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {([1, 2, 3, 4] as const).map((pNum) => {
                const isCurrent = selectedProbNum === pNum;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => {
                      playBeep(state.soundEnabled, 600 + pNum * 50, 0.05);
                      setSelectedProbNum(pNum);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    문제 {pNum}번
                  </button>
                );
              })}
            </div>

            {/* Source Section Toggle */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 font-bold hidden sm:inline">출제 섹션:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg font-bold text-slate-700">
                {activeSections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setProblemSectionId(sec.id)}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer text-xs ${
                      problemSectionId === sec.id
                        ? 'bg-blue-600 text-white shadow-2xs font-black'
                        : 'hover:bg-slate-200'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Problem Cards Grid: Clean display with NO redundant range text */}
          {problemItems.length > 0 ? (
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {problemItems.map((item) => {
                const probText = getProblemTextForRow(item, selectedProbNum);
                const activeSecName =
                  activeSections.find((s) => s.id === problemSectionId)?.name || '선택 섹션';
                const words = probText
                  ? probText
                      .split(',')
                      .map((w) => w.trim())
                      .filter(Boolean)
                  : [];

                return (
                  <div
                    key={`prob-${selectedProbNum}-${item.id}`}
                    className="relative group rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition p-2.5 sm:p-3 shadow-2xs flex items-center gap-2.5"
                  >
                    {/* Left: Prominent Level Badge */}
                    <div className="relative shrink-0 flex flex-col items-center">
                      <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-blue-700 text-white font-black text-sm sm:text-base md:text-lg min-w-[56px] sm:min-w-[62px] text-center tracking-tight shadow-2xs">
                        {item.levelLabel}
                      </span>
                    </div>

                    {/* Right: Large Problem Text (NO range text) */}
                    <div className="flex-1 min-w-0 flex items-center justify-center bg-white py-2 px-2.5 rounded-lg border border-slate-200/80 shadow-2xs min-h-[48px]">
                      {probText ? (
                        words.length > 1 ? (
                          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 w-full">
                            {words.map((word, wIdx) => (
                              <span
                                key={wIdx}
                                className={`${getProblemTextClass()} text-slate-950 tracking-tight leading-tight`}
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p
                            className={`${getProblemTextClass()} text-slate-950 leading-tight tracking-tight text-center break-words`}
                          >
                            {probText}
                          </p>
                        )
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          {item.rangeName ? `문제 미등록 (${item.rangeName})` : '문제 미설정'}
                        </span>
                      )}
                    </div>

                    {/* Focus Modal Button */}
                    <button
                      type="button"
                      onClick={() => setFocusModalItem({ item, secName: activeSecName })}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer shrink-0"
                      title="이 급수만 칠판에 초대형으로 확대"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              출제 대상 섹션에 급수가 없습니다. 상단에서 급수를 추가해주세요.
            </div>
          )}
        </section>
      )}

      {/* 4. BLACKBOARD FOCUS MODAL */}
      {focusModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-2xl sm:text-3xl shadow-md">
                  {focusModalItem.item.levelLabel}
                </span>
                <div>
                  <h4 className="text-lg sm:text-xl font-black text-slate-900">
                    {focusModalItem.item.rangeName || '진도 범위'}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    {focusModalItem.secName} • 칠판 집중 모드
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFocusModalItem(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Problem 1~4 Selectors in Modal */}
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as const).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setSelectedProbNum(pNum)}
                  className={`py-2.5 rounded-xl font-black text-sm sm:text-base transition cursor-pointer text-center ${
                    selectedProbNum === pNum
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  문제 {pNum}번
                </button>
              ))}
            </div>

            {/* Massive Cinema Problem Display */}
            <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 text-center min-h-[180px] flex items-center justify-center shadow-inner">
              {(() => {
                const txt = getProblemTextForRow(focusModalItem.item, selectedProbNum);
                if (!txt) {
                  return (
                    <div className="space-y-1">
                      <p className="text-lg sm:text-xl text-slate-400 font-bold">
                        등록된 문제가 없습니다.
                      </p>
                      <p className="text-xs text-slate-500">
                        관리자 화면에서 문제 {selectedProbNum}번을 등록해주세요.
                      </p>
                    </div>
                  );
                }
                const parts = txt.split(',').map((w) => w.trim()).filter(Boolean);
                return (
                  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                    {parts.map((word, wIdx) => (
                      <span
                        key={wIdx}
                        className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none text-white drop-shadow-md"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const items = problemItems;
                  const currentIdx = items.findIndex((i) => i.id === focusModalItem.item.id);
                  if (currentIdx > 0) {
                    setFocusModalItem({
                      item: items[currentIdx - 1],
                      secName: focusModalItem.secName,
                    });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ◀ 이전 급수
              </button>

              <button
                type="button"
                onClick={() => setFocusModalItem(null)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                닫기
              </button>

              <button
                type="button"
                onClick={() => {
                  const items = problemItems;
                  const currentIdx = items.findIndex((i) => i.id === focusModalItem.item.id);
                  if (currentIdx < items.length - 1) {
                    setFocusModalItem({
                      item: items[currentIdx + 1],
                      secName: focusModalItem.secName,
                    });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                다음 급수 ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
