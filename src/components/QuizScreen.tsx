import React, { useState, useEffect } from 'react';
import {
  Shuffle,
  Printer,
  Sparkles,
} from 'lucide-react';
import { AppState } from '../types';
import { playBeep } from '../utils/audio';
import { PrintSheetModal } from './PrintSheetModal';

interface QuizScreenProps {
  state: AppState;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({ state }) => {
  const [selectedLevel, setSelectedLevel] = useState<string>(state.levels[0] || '8급');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [generatedItems, setGeneratedItems] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Generate Questions from Quiz Pool
  const handleGenerateQuiz = (lvl = selectedLevel, count = questionCount) => {
    playBeep(state.soundEnabled, 650, 0.08);

    // 1. Check if level has items in quizPool
    const pool = state.quizPool?.[lvl] || [];

    // Fallback: If quizPool is empty for this level, harvest from bank
    let combinedPool: string[] = [...pool];
    if (combinedPool.length === 0 && state.bank[lvl]) {
      Object.values(state.bank[lvl]).forEach((rangeData) => {
        ([1, 2, 3, 4] as const).forEach((pNum) => {
          const val = rangeData[`prob${pNum}`];
          if (typeof val === 'string' && val.trim()) {
            const pieces = val.split(/[,;\n]/).map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
            combinedPool.push(...pieces);
          }
        });
      });
    }

    if (combinedPool.length === 0) {
      alert(`[${lvl}]에 등록된 한자 뜻·음 풀이 없습니다. 관리자 모드에서 한자를 등록해주세요.`);
      return;
    }

    // Deduplicate & Shuffle
    const uniquePool = Array.from(new Set(combinedPool.map((s) => s.trim()))).filter(Boolean);
    const shuffled = [...uniquePool].sort(() => Math.random() - 0.5);

    // Pick up to count
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }

    setGeneratedItems(result);
  };

  // Auto-generate on first load
  useEffect(() => {
    if (selectedLevel && generatedItems.length === 0) {
      handleGenerateQuiz(selectedLevel, questionCount);
    }
  }, [selectedLevel]);

  return (
    <div id="screen-quiz" className="space-y-6">
      {/* 1. Controls Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              실시간 한자 문제 출제 (무작위 섞기)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>시험지 인쇄 / PDF</span>
          </button>
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Level Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              급수 선택:
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                handleGenerateQuiz(e.target.value, questionCount);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-black text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
            >
              {state.levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl} (풀: {state.quizPool?.[lvl]?.length || 0}개)
                </option>
              ))}
            </select>
          </div>

          {/* Question Count Selector (up to 20) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              문항 수:
            </label>
            <div className="flex items-center gap-1">
              {[5, 10, 15, 20].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    setQuestionCount(cnt);
                    handleGenerateQuiz(selectedLevel, cnt);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    questionCount === cnt
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cnt}개
                </button>
              ))}
            </div>
          </div>

          {/* Shuffle / Re-roll Button */}
          <button
            type="button"
            onClick={() => handleGenerateQuiz(selectedLevel, questionCount)}
            className="ml-auto px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Shuffle className="w-4 h-4" />
            <span>무작위 다시 섞기</span>
          </button>
        </div>
      </div>

      {/* 2. BIG BOLD MEANING-SOUND DISPLAY (Pure, Clean, Large Text for Classroom Presentation) */}
      {generatedItems.length > 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-sm">
                {selectedLevel}
              </span>
              <span className="text-sm font-bold text-slate-600">
                출제된 {generatedItems.length}개 한자 뜻·음
              </span>
            </div>
            <span className="text-xs text-slate-400">
              화면 가득 큰 글씨로 표시됩니다
            </span>
          </div>

          {/* Large Card Grid: Maximum readable Korean Meaning and Sound */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-2">
            {generatedItems.map((itemText, idx) => (
              <div
                key={`${itemText}-${idx}`}
                className="bg-slate-50 hover:bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all duration-200 shadow-xs flex flex-col items-center justify-center text-center min-h-[110px] group"
              >
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-blue-700 transition">
                  {itemText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Sheet Modal */}
      {isPrintModalOpen && (
        <PrintSheetModal
          onClose={() => setIsPrintModalOpen(false)}
          title={`[${selectedLevel}] 한자 확인 평가 (${generatedItems.length}문항)`}
          subTitle={`출제 문항: ${generatedItems.length}개`}
          questions={generatedItems.map((mean, idx) => ({ id: `q-${idx}`, mean }))}
        />
      )}
    </div>
  );
};
