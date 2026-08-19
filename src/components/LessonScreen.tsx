import React, { useState } from 'react';
import {
  EyeOff,
  RefreshCw,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { AppState, RangeProblemData, SectionRole } from '../types';
import { playBeep } from '../utils/audio';

interface LessonScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onToggleLevelHide: (level: string) => void;
  onRestoreAllLevels: () => void;
}

export const LessonScreen: React.FC<LessonScreenProps> = ({
  state,
  onUpdateState,
  onToggleLevelHide,
  onRestoreAllLevels,
}) => {
  // Active problem tab: 1, 2, 3, 4
  const [selectedProbNum, setSelectedProbNum] = useState<1 | 2 | 3 | 4>(1);

  // Problem source section: 'A' | 'B' | 'C'
  const [problemSection, setProblemSection] = useState<'A' | 'B' | 'C'>('B');

  // Sticker Cycle: prev -> today -> next -> custom -> prev
  const cycleSectionRole = (section: 'A' | 'B' | 'C') => {
    playBeep(state.soundEnabled, 600, 0.06);
    const current = state.sectionRoles[section];
    const order: SectionRole[] = ['prev', 'today', 'next', 'custom'];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    const nextRole = order[nextIdx];

    onUpdateState((prev) => ({
      ...prev,
      sectionRoles: {
        ...prev.sectionRoles,
        [section]: nextRole,
      },
    }));
  };

  // Rotate all 3 stickers: A -> B -> C -> A
  const handleRotateAllStickers = () => {
    playBeep(state.soundEnabled, 700, 0.08);
    onUpdateState((prev) => ({
      ...prev,
      sectionRoles: {
        A: prev.sectionRoles.C,
        B: prev.sectionRoles.A,
        C: prev.sectionRoles.B,
      },
    }));
  };

  const getRoleBadge = (role: SectionRole) => {
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
      default:
        return {
          label: '기타/자유 진도',
          color: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
          dot: 'bg-amber-500',
        };
    }
  };

  const visibleLevels = state.levels.filter((lvl) => !state.hiddenLevels.includes(lvl));

  const getProblemText = (lvl: string, secKey: 'A' | 'B' | 'C', probNum: 1 | 2 | 3 | 4): string => {
    const planKey = `plan${secKey}` as keyof typeof state.lessonData[string];
    const rangeName = state.lessonData[lvl]?.[planKey] || '';
    if (!rangeName) return '';

    const rangeData = state.bank[lvl]?.[rangeName];
    if (!rangeData) return '';

    const probKey = `prob${probNum}` as keyof RangeProblemData;
    const txt = rangeData[probKey];
    return typeof txt === 'string' ? txt : '';
  };

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

      {/* Global Sticker Rotation Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-sm">진도 스티커 안내:</span>
          <span className="text-slate-600">
            각 섹션의 🏷️ 스티커를 클릭하여 <strong>[저번 시간 / 오늘 / 다음 시간]</strong>을 변경할 수 있습니다.
          </span>
        </div>

        <button
          type="button"
          onClick={handleRotateAllStickers}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition shadow-2xs cursor-pointer active:scale-98"
        >
          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
          <span>🔄 다음 주로 진도 일괄 순환 (A→B→C)</span>
        </button>
      </div>

      {/* FULL-WIDTH 3 LESSON SECTIONS (A, B, C) */}
      <div className="space-y-6">
        {(['A', 'B', 'C'] as const).map((secKey) => {
          const role = state.sectionRoles[secKey];
          const badge = getRoleBadge(role);
          const planKey = `plan${secKey}` as keyof typeof state.lessonData[string];

          return (
            <section
              key={secKey}
              className={`bg-white rounded-2xl p-5 sm:p-6 border shadow-xs transition ${
                role === 'today' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-2xs">
                    {secKey}
                  </span>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    섹션 {secKey}
                  </h2>

                  {/* Clickable Role Sticker */}
                  <button
                    type="button"
                    onClick={() => cycleSectionRole(secKey)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95 ${badge.color}`}
                    title="클릭하여 역할 변경 (저번시간/오늘/다음시간)"
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
                    <span>🏷️ {badge.label}</span>
                    <span className="text-[11px] opacity-75 ml-0.5">(클릭변경)</span>
                  </button>
                </div>

                <span className="text-xs font-semibold text-slate-400">
                  {visibleLevels.length}개 급수 전체 표시
                </span>
              </div>

              {/* 11+ Levels Responsive Grid: Full Text Visible, No Truncation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleLevels.map((lvl) => {
                  const rangeName = state.lessonData[lvl]?.[planKey] || '(범위 미설정)';
                  return (
                    <div
                      key={`${secKey}-${lvl}`}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition flex items-start justify-between gap-2 shadow-2xs min-h-[58px]"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-800 text-white font-black text-xs sm:text-sm min-w-[54px] shrink-0 mt-0.5 shadow-2xs">
                          {lvl}
                        </span>
                        {/* Range Text is fully visible and large */}
                        <div className="text-slate-900 font-bold text-sm sm:text-base leading-snug break-words flex-1 whitespace-normal">
                          {rangeName}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleLevelHide(lvl)}
                        className="text-[11px] p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition shrink-0 cursor-pointer"
                        title={`${lvl} 숨기기`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
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

          {/* Section Source Picker */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <span className="px-2 text-slate-400">출제 대상:</span>
            {(['A', 'B', 'C'] as const).map((sec) => {
              const role = state.sectionRoles[sec];
              const label = role === 'today' ? `섹션 ${sec} (오늘)` : role === 'prev' ? `섹션 ${sec} (저번)` : `섹션 ${sec}`;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setProblemSection(sec)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                    problemSection === sec
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {label}
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

        {/* 11+ Levels Problem Cards with Large Bold Korean Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {visibleLevels.map((lvl) => {
            const probText = getProblemText(lvl, problemSection, selectedProbNum);

            return (
              <div
                key={`prob-${selectedProbNum}-${lvl}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-800 text-white font-black text-xs sm:text-sm shadow-2xs">
                    {lvl}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    섹션 {problemSection} • 문제 {selectedProbNum}번
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 min-h-[50px] flex items-center">
                  {probText ? (
                    <p className="text-slate-900 font-black text-base sm:text-lg leading-relaxed break-words whitespace-normal">
                      {probText}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      (등록된 문제 없음)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
