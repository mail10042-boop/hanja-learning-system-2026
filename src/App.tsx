import React, { useState, useEffect } from 'react';
import { ActiveTab, AppState, LevelLessonPlan } from './types';
import { INITIAL_STATE } from './data/initialData';
import { Navbar } from './components/Navbar';
import { LessonScreen } from './components/LessonScreen';
import { QuizScreen } from './components/QuizScreen';
import { AdminScreen } from './components/AdminScreen';
import { FloatingTimer } from './components/FloatingTimer';

const STORAGE_KEY = 'hanjaSystemData_v7';

function normalizeLessonData(rawLessonData: unknown): Record<string, LevelLessonPlan> {
  const result: Record<string, LevelLessonPlan> = {};
  const baseLevels = INITIAL_STATE.levels;
  const dataObj = typeof rawLessonData === 'object' && rawLessonData !== null ? (rawLessonData as Record<string, any>) : {};
  const allLevels = Array.from(new Set([...baseLevels, ...Object.keys(dataObj)]));

  for (const lvl of allLevels) {
    const rawLevel = dataObj[lvl];
    const initialLevel = INITIAL_STATE.lessonData[lvl] || INITIAL_STATE.lessonData['8급'];

    const getPlanStr = (key: 'A' | 'B' | 'C', legacyKey: 'prev' | 'today' | 'next') => {
      const planVal = rawLevel?.[`plan${key}`];
      if (typeof planVal === 'string' && planVal) return planVal;

      const legacyVal = rawLevel?.[legacyKey];
      if (typeof legacyVal === 'string' && legacyVal) return legacyVal;
      if (legacyVal && typeof legacyVal === 'object' && typeof legacyVal.rangeName === 'string') return legacyVal.rangeName;

      return initialLevel[`plan${key}`] || '';
    };

    result[lvl] = {
      planA: getPlanStr('A', 'prev'),
      planB: getPlanStr('B', 'today'),
      planC: getPlanStr('C', 'next'),
    };
  }
  return result;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hanjaSystemData_v6') || localStorage.getItem('hanjaSystemData_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        const bank = parsed.bank && Object.keys(parsed.bank).length && parsed.bank['8급']?.['1과 기초 자연 (10p)']
          ? parsed.bank
          : INITIAL_STATE.bank;

        const normalizedLessonData = normalizeLessonData(parsed.lessonData);
        const sectionRoles = parsed.sectionRoles?.A ? parsed.sectionRoles : INITIAL_STATE.sectionRoles;
        const quizPool = parsed.quizPool && Object.keys(parsed.quizPool).length > 0 ? { ...INITIAL_STATE.quizPool, ...parsed.quizPool } : INITIAL_STATE.quizPool;

        return {
          ...INITIAL_STATE,
          ...parsed,
          levels: parsed.levels?.length ? parsed.levels : INITIAL_STATE.levels,
          bank,
          quizPool,
          lessonData: normalizedLessonData,
          sectionRoles,
        };
      }
    } catch (err) {
      console.warn('Failed to load local storage state', err);
    }
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('lesson');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [showFloatingTimer, setShowFloatingTimer] = useState<boolean>(true);

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to persist to localStorage', err);
    }
  }, [state]);

  // Adjust root element font size dynamically
  useEffect(() => {
    document.documentElement.style.fontSize = `${state.fontSize}px`;
  }, [state.fontSize]);

  const handleIncreaseFont = () => {
    setState((prev) => ({
      ...prev,
      fontSize: Math.min(26, prev.fontSize + 1),
    }));
  };

  const handleDecreaseFont = () => {
    setState((prev) => ({
      ...prev,
      fontSize: Math.max(14, prev.fontSize - 1),
    }));
  };

  const handleResetFont = () => {
    setState((prev) => ({
      ...prev,
      fontSize: 18,
    }));
  };

  const handleToggleSound = () => {
    setState((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }));
  };

  const handleToggleLevelHide = (level: string) => {
    setState((prev) => {
      const isHidden = prev.hiddenLevels.includes(level);
      const nextHidden = isHidden
        ? prev.hiddenLevels.filter((l) => l !== level)
        : [...prev.hiddenLevels, level];
      return {
        ...prev,
        hiddenLevels: nextHidden,
      };
    });
  };

  const handleRestoreAllLevels = () => {
    setState((prev) => ({
      ...prev,
      hiddenLevels: [],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans selection:bg-blue-200">
      {/* Top Navigation & Controls */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fontSize={state.fontSize}
        onIncreaseFont={handleIncreaseFont}
        onDecreaseFont={handleDecreaseFont}
        onResetFont={handleResetFont}
        soundEnabled={state.soundEnabled}
        onToggleSound={handleToggleSound}
        isAdminAuthenticated={isAdminAuthenticated}
        showFloatingTimer={showFloatingTimer}
        onToggleFloatingTimer={() => setShowFloatingTimer((prev) => !prev)}
      />

      {/* Globally Draggable Floating Timer across all views & scrolling */}
      {showFloatingTimer && <FloatingTimer soundEnabled={state.soundEnabled} />}

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'lesson' && (
          <LessonScreen
            state={state}
            onUpdateState={setState}
            onToggleLevelHide={handleToggleLevelHide}
            onRestoreAllLevels={handleRestoreAllLevels}
          />
        )}

        {activeTab === 'quiz' && <QuizScreen state={state} />}

        {activeTab === 'admin' && (
          <AdminScreen
            state={state}
            onUpdateState={setState}
            isAdminAuthenticated={isAdminAuthenticated}
            setIsAdminAuthenticated={setIsAdminAuthenticated}
          />
        )}
      </main>

      {/* Classroom Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>한자 학습 보조 관리 시스템 (초·중등 급수별 한자 교육 보조 도구)</span>
          <span className="text-slate-400">데이터는 브라우저 로컬 저장소에 안전하게 유지됩니다.</span>
        </div>
      </footer>
    </div>
  );
}
