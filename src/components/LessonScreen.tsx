import React, { useState } from 'react';
import {
  EyeOff,
  RefreshCw,
  RotateCcw,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
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

  // Active dynamic sections list with safe fallback
  const activeSections: SectionItem[] = state.sections && state.sections.length > 0
    ? state.sections
    : INITIAL_STATE.sections;

  // Problem source section: dynamic section ID
  const [problemSectionId, setProblemSectionId] = useState<string>(
    activeSections.find((s) => s.role === 'today')?.id || activeSections[0]?.id || 'A'
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

  // Add new section (D, E, F...)
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
        { id: `row_${newId}_2`, levelLabel: '준5급 0', rangeName: '8과 (140p)' },
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
  const handleDeleteSection = (secId: string, secName: string) => {
    if (activeSections.length <= 1) {
      return;
    }

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.filter((s) => s.id !== secId),
      };
    });

    if (problemSectionId === secId) {
      const fallback = activeSections.find((s) => s.id !== secId)?.id || 'A';
      setProblemSectionId(fallback);
    }
  };

  // Cycle role for a specific section
  const cycleSectionRole = (secId: string) => {
    playBeep(state.soundEnabled, 600, 0.06);
    const ROLES: { role: string; label: string }[] = [
      { role: 'prev', label: '저번 시간에 배운 한자' },
      { role: 'today', label: '오늘 배울 한자' },
      { role: 'next', label: '다음 시간에 배울 한자' },
      { role: 'review', label: '복습·심화 진도' },
      { role: 'homework', label: '과제·자율 진도' },
      { role: 'custom', label: '기타/자유 진도' },
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

  // Rotate roles sequentially across sections
  const handleRotateAllStickers = () => {
    playBeep(state.soundEnabled, 700, 0.08);
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      if (currentSections.length <= 1) return prev;

      const firstRole = currentSections[0].role;
      const nextSections = currentSections.map((s, idx) => {
        if (idx === currentSections.length - 1) {
          return { ...s, role: firstRole };
        }
        return { ...s, role: currentSections[idx + 1].role };
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
      const nextSections = currentSections.map((s) => (s.id === secId ? { ...s, name: trimmed } : s));
      return { ...prev, sections: nextSections };
    });
    setEditingSectionId(null);
  };

  // Add Item to ALL Sections simultaneously (e.g. 준5급 0, 준5급 1, etc.)
  const handleAddItemToSection = (secId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    playBeep(state.soundEnabled, 750, 0.06);
    const baseLvl = extractBaseLevel(trimmed);
    const commonRowId = `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s, secIdx) => {
          const bankRanges = prev.bank[baseLvl] ? Object.keys(prev.bank[baseLvl]) : [];
          const defaultRange = bankRanges[secIdx % Math.max(1, bankRanges.length)] || `${trimmed} 진도 범위`;
          const newRow: SectionRowItem = {
            id: commonRowId,
            levelLabel: trimmed,
            baseLevel: baseLvl,
            rangeName: defaultRange,
          };
          return {
            ...s,
            items: [...(s.items || []), newRow],
          };
        }),
      };
    });

    setCustomAddInput('');
  };

  // Remove an Item from ALL sections
  const handleDeleteItemFromSection = (secId: string, rowId: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => ({
          ...s,
          items: (s.items || []).filter((r) => r.id !== rowId),
        })),
      };
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'prev':
        return {
          label: '저번 시간에 배운 한자',
          color: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
          dot: 'bg-slate-500',
        };
      case 'today':
        return {
          label: '오늘 배울 한자',
          color: 'bg-blue-600 text-white border-blue-700 hover:bg-blue-500 shadow-2xs',
          dot: 'bg-white',
        };
      case 'next':
        return {
          label: '다음 시간에 배울 한자',
          color: 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500 shadow-2xs',
          dot: 'bg-white',
        };
      case 'review':
        return {
          label: '복습·심화 진도',
          color: 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500 shadow-2xs',
          dot: 'bg-white',
        };
      case 'homework':
        return {
          label: '과제·자율 진도',
          color: 'bg-purple-600 text-white border-purple-700 hover:bg-purple-500 shadow-2xs',
          dot: 'bg-white',
        };
      default:
        return {
          label: '기타/자유 진도',
          color: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
          dot: 'bg-amber-500',
        };
    }
  };

  // Helper to extract problem text for a row item
  const getProblemTextForRow = (row: SectionRowItem, probNum: 1 | 2 | 3 | 4): string => {
    // 1. Check direct custom problem override
    const customKey = `customProb${probNum}` as keyof SectionRowItem;
    if (typeof row[customKey] === 'string' && (row[customKey] as string).trim()) {
      return (row[customKey] as string).trim();
    }

    // 2. Base level lookup in problem bank
    const baseLvl = row.baseLevel || extractBaseLevel(row.levelLabel);
    const rangeData = state.bank[baseLvl]?.[row.rangeName];
    if (rangeData) {
      const probKey = `prob${probNum}` as keyof typeof rangeData;
      const txt = rangeData[probKey];
      if (typeof txt === 'string' && txt.trim()) return txt.trim();
    }

    // 3. Check exact label match in bank
    const directRangeData = state.bank[row.levelLabel]?.[row.rangeName];
    if (directRangeData) {
      const probKey = `prob${probNum}` as keyof typeof directRangeData;
      const txt = directRangeData[probKey];
      if (typeof txt === 'string' && txt.trim()) return txt.trim();
    }

    return '';
  };

  // Find target section for problem section
  const currentProblemSection = activeSections.find((s) => s.id === problemSectionId) || activeSections[0];
  const problemItems = (currentProblemSection?.items || []).filter(
    (item) => !state.hiddenLevels.includes(item.levelLabel) && !state.hiddenLevels.includes(extractBaseLevel(item.levelLabel))
  );

  return (
    <div id="screen-lesson" className="space-y-6">
      {/* Hidden levels bar */}
      {state.hiddenLevels.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <EyeOff className="w-4 h-4 text-amber-600" />
            <span>숨겨진 급수 ({state.hiddenLevels.length}개):</span>
            <div className="flex flex-wrap gap-1">
              {state.hiddenLevels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onToggleLevelHide(lvl)}
                  className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition cursor-pointer flex items-center gap-1"
                  title="클릭하여 다시 표시"
                >
                  <span>{lvl}</span>
                  <span className="text-amber-500 hover:text-amber-700">✕</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onRestoreAllLevels}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            모든 급수 다시 표시
          </button>
        </div>
      )}

      {/* Global Section Controls Bar: Add Section & Rotate Stickers */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-slate-800 text-sm">진도 섹션 ({activeSections.length}개):</span>
          <span className="text-slate-600">
            각 섹션별로 <strong>준5급 0, 준5급 1, 준6급</strong> 등 원하는 급수를 자유롭게 추가하고 진도를 설정할 수 있습니다.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Add Section Button */}
          <button
            type="button"
            onClick={handleAddSection}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-2xs cursor-pointer active:scale-95"
            title="새로운 진도 섹션 추가하기 (섹션 D, E...)"
          >
            <Plus className="w-4 h-4" />
            <span>+ 새 섹션 추가</span>
          </button>

          {activeSections.length > 1 && (
            <button
              type="button"
              onClick={handleRotateAllStickers}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition shadow-2xs cursor-pointer active:scale-98"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>🔄 진도 일괄 순환</span>
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC FULL-WIDTH LESSON SECTIONS (A, B, C, D...) */}
      <div className="space-y-6">
        {activeSections.map((sec, index) => {
          const role = sec.role;
          const badge = getRoleBadge(role);
          const isEditing = editingSectionId === sec.id;
          const isAddBoxOpen = openAddBoxSecId === sec.id;
          const rawItems = sec.items || [];
          const visibleItems = rawItems.filter(
            (r) => !state.hiddenLevels.includes(r.levelLabel) && !state.hiddenLevels.includes(extractBaseLevel(r.levelLabel))
          );

          return (
            <section
              key={sec.id}
              className={`bg-white rounded-2xl p-5 sm:p-6 border shadow-xs transition ${
                role === 'today' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-2xs">
                    {index + 1}
                  </span>

                  {/* Editable Section Name */}
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        className="px-2.5 py-1 text-base font-black rounded-lg border border-blue-400 focus:ring-2 focus:ring-blue-500 w-36"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(sec.id)}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(sec.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                        title="이름 저장"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {sec.name}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSectionId(sec.id);
                          setEditTitleInput(sec.name);
                        }}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded-md opacity-70 group-hover:opacity-100 transition cursor-pointer"
                        title="섹션 이름 바꾸기"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Clickable Role Sticker */}
                  <button
                    type="button"
                    onClick={() => cycleSectionRole(sec.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95 ${badge.color}`}
                    title="클릭하여 역할 변경 (저번시간/오늘/다음시간/복습 등)"
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
                    <span>🏷️ {badge.label}</span>
                    <span className="text-[11px] opacity-75 ml-0.5">(클릭변경)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Quick Add Level Item Button for this section */}
                  <button
                    type="button"
                    onClick={() => setOpenAddBoxSecId(isAddBoxOpen ? null : sec.id)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      isAddBoxOpen
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 급수 항목 추가 ({visibleItems.length}개)</span>
                  </button>

                  {/* Delete Section button if > 1 section exists */}
                  {activeSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec.id, sec.name)}
                      className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="이 섹션 삭제하기"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>삭제</span>
                    </button>
                  )}
                </div>
              </div>

              {/* QUICK INLINE LEVEL ADDER (Expands when clicked) */}
              {isAddBoxOpen && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-blue-200 mb-4 space-y-2 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>💡 [{sec.name}]에 추가할 급수를 선택하거나 직접 입력하세요:</span>
                  </div>

                  {/* Preset quick pills */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {COMMON_PRESET_BUTTONS.map((btnLabel) => (
                      <button
                        key={btnLabel}
                        type="button"
                        onClick={() => handleAddItemToSection(sec.id, btnLabel)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        +{btnLabel}
                      </button>
                    ))}
                  </div>

                  {/* Custom input line */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      value={customAddInput}
                      onChange={(e) => setCustomAddInput(e.target.value)}
                      placeholder="자유 급수명 직접 입력 (예: 준5급 0, 준5급 1, 준6급 심화반)..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddItemToSection(sec.id, customAddInput)}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddItemToSection(sec.id, customAddInput)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {/* Levels Responsive Grid for this section: Full Text Visible, Big Bold Label */}
              {visibleItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleItems.map((item) => {
                    const itemKey = `${sec.id}_${item.id}`;
                    const isEditingRange = editingRangeItemKey === itemKey;
                    const baseLvl = item.baseLevel || extractBaseLevel(item.levelLabel);
                    const bankRanges = getOrderedBankRanges(state.bank, state.bankRangeOrder, baseLvl);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 shadow-2xs min-h-[64px] ${
                          isEditingRange
                            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-200'
                            : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-800 text-white font-black text-xs sm:text-sm min-w-[54px] shrink-0 mt-0.5 shadow-2xs">
                              {item.levelLabel}
                            </span>

                            {/* Range display or inline editor */}
                            {isEditingRange ? (
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={editingRangeValue}
                                    onChange={(e) => setEditingRangeValue(e.target.value)}
                                    placeholder={`${sec.name} 진도 범위 입력...`}
                                    className="flex-1 px-2 py-1 text-xs sm:text-sm font-bold rounded-lg border border-blue-400 bg-white focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveItemRange(sec.id, item.id, editingRangeValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingRangeItemKey(null);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveItemRange(sec.id, item.id, editingRangeValue)}
                                    className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-2xs shrink-0"
                                    title="저장"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingRangeItemKey(null)}
                                    className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer shrink-0"
                                    title="취소"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {bankRanges.length > 0 && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                    <span className="text-slate-400 text-[10px]">문제은행:</span>
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          setEditingRangeValue(e.target.value);
                                        }
                                      }}
                                      defaultValue=""
                                      className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-blue-700 font-bold max-w-[140px] cursor-pointer"
                                    >
                                      <option value="">범위 선택...</option>
                                      {bankRanges.map((rng) => (
                                        <option key={rng} value={rng}>
                                          {rng}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingRangeItemKey(itemKey);
                                  setEditingRangeValue(item.rangeName || '');
                                }}
                                className="text-slate-900 font-bold text-sm sm:text-base leading-snug break-words flex-1 whitespace-normal cursor-pointer group flex items-start justify-between gap-1"
                                title={`클릭하여 [${sec.name}] 진도 수정`}
                              >
                                <span>{item.rangeName || '(진도 범위 미설정)'}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-blue-600 p-0.5 rounded hover:bg-blue-50 transition shrink-0">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            )}
                          </div>

                          {!isEditingRange && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRangeItemKey(itemKey);
                                  setEditingRangeValue(item.rangeName || '');
                                }}
                                className="text-[11px] p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
                                title={`[${sec.name}] 진도 수정`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleLevelHide(item.levelLabel)}
                                className="text-[11px] p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition cursor-pointer"
                                title={`${item.levelLabel} 화면에서 숨기기`}
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItemFromSection(sec.id, item.id)}
                                className="text-[11px] p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="이 항목 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  등록된 급수 항목이 없습니다. 상단의 [+ 급수 항목 추가] 버튼을 눌러 원하는 급수를 넣어주세요.
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* FULL-WIDTH 수업 확인 문제 영역 (문제 1번, 2번, 3번, 4번) */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              수업 확인 문제 (급수별 문제 풀이)
            </h3>
          </div>

          {/* Dynamic Section Source Picker */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 flex-wrap">
            <span className="px-2 text-slate-400">출제 대상:</span>
            {activeSections.map((sec) => {
              const roleBadge = getRoleBadge(sec.role);
              const isSelected = problemSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setProblemSectionId(sec.id)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>{sec.name}</span>
                  <span className={`text-[10px] opacity-80 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    ({roleBadge.label.split(' ')[0]})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Problem Selectors */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {([1, 2, 3, 4] as const).map((pNum) => (
            <button
              key={pNum}
              type="button"
              onClick={() => setSelectedProbNum(pNum)}
              className={`py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-lg transition cursor-pointer text-center ${
                selectedProbNum === pNum
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              문제 {pNum}번
            </button>
          ))}
        </div>

        {/* Selected Items Problem Cards with Large Bold Korean Text */}
        {problemItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {problemItems.map((item) => {
              const probText = getProblemTextForRow(item, selectedProbNum);
              const activeSecName = activeSections.find((s) => s.id === problemSectionId)?.name || '선택 섹션';

              return (
                <div
                  key={`prob-${selectedProbNum}-${item.id}`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-800 text-white font-black text-xs sm:text-sm shadow-2xs">
                      {item.levelLabel}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {activeSecName} • 문제 {selectedProbNum}번
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 min-h-[50px] flex items-center">
                    {probText ? (
                      <p className="text-slate-900 font-black text-base sm:text-lg leading-relaxed break-words whitespace-normal">
                        {probText}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        {item.rangeName ? `[${item.rangeName}] 문제 미등록` : '(등록된 문제 없음)'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            출제 대상 섹션에 등록된 진도 항목이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
};
