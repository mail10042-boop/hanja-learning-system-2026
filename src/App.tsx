import React, { useState, useEffect } from 'react';
import { ActiveTab, AppState, LevelLessonPlan, SectionItem, SectionRowItem } from './types';
import { INITIAL_STATE } from './data/initialData';
import { Navbar } from './components/Navbar';
import { LessonScreen } from './components/LessonScreen';
import { QuizScreen } from './components/QuizScreen';
import { AdminScreen } from './components/AdminScreen';
import { FloatingTimer } from './components/FloatingTimer';
import { sortHanjaLevels, sortSectionRowItems } from './utils/levelOrder';

const STORAGE_KEY = 'hanjaSystemData_v11';
const BACKUP_KEY = 'hanja_auto_backup_latest';
const BACKUP_SNAPSHOT_KEY = 'hanja_auto_backup_snapshot';

function normalizeLessonData(rawLessonData: unknown, baseLevels: string[]): Record<string, LevelLessonPlan> {
  const result: Record<string, LevelLessonPlan> = {};
  const dataObj = typeof rawLessonData === 'object' && rawLessonData !== null ? (rawLessonData as Record<string, any>) : {};
  const allLevels = Array.from(new Set([...baseLevels, ...Object.keys(dataObj)]));

  for (const lvl of allLevels) {
    const rawLevel = dataObj[lvl];
    const initialLevel = INITIAL_STATE.lessonData[lvl] || INITIAL_STATE.lessonData['8급'] || { planA: '', planB: '', planC: '' };

    const getPlanStr = (key: 'A' | 'B' | 'C') => {
      const planVal = rawLevel?.[`plan${key}`];
      if (typeof planVal === 'string' && planVal) return planVal;
      return initialLevel[`plan${key}`] || '';
    };

    result[lvl] = {
      planA: getPlanStr('A'),
      planB: getPlanStr('B'),
      planC: getPlanStr('C'),
    };
  }
  return result;
}

function ensureSectionItems(sections: any[], levels: string[], sectionPlans: any): SectionItem[] {
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return INITIAL_STATE.sections;
  }

  // Find master items template (usually from first section)
  const masterSec = sections[0];
  const masterItems: SectionRowItem[] = masterSec?.items && Array.isArray(masterSec.items) && masterSec.items.length > 0
    ? masterSec.items
    : INITIAL_STATE.sections[0].items;

  return sections.map((sec, idx) => {
    const secId = sec.id || `sec_${idx + 1}`;
    const secName = sec.name || `섹션 ${String.fromCharCode(65 + idx)}`;
    const role = sec.role || (idx === 0 ? 'prev' : idx === 1 ? 'today' : 'next');

    // If section has items, align them to master structure while preserving individual rangeName
    if (sec.items && Array.isArray(sec.items) && sec.items.length > 0) {
      // Map master items to ensure row order and IDs match across all sections
      const alignedItems: SectionRowItem[] = masterItems.map((mItem, rIdx) => {
        const existingInSec = sec.items.find(
          (it: any) => it.id === mItem.id || it.levelLabel === mItem.levelLabel
        );
        return {
          id: mItem.id,
          levelLabel: mItem.levelLabel,
          baseLevel: mItem.baseLevel,
          rangeName: existingInSec?.rangeName || sec.items[rIdx]?.rangeName || mItem.rangeName,
          customProb1: existingInSec?.customProb1 ?? mItem.customProb1,
          customProb2: existingInSec?.customProb2 ?? mItem.customProb2,
          customProb3: existingInSec?.customProb3 ?? mItem.customProb3,
          customProb4: existingInSec?.customProb4 ?? mItem.customProb4,
        };
      });

      return {
        id: secId,
        name: secName,
        role,
        items: alignedItems,
      };
    }

    // Fallback: convert from levels/sectionPlans
    const chosenLevels = sec.selectedLevels?.length ? sec.selectedLevels : levels;
    const generatedItems: SectionRowItem[] = chosenLevels.map((lvl: string, rIdx: number) => {
      const range = sectionPlans?.[secId]?.[lvl] || `${lvl} 진도 범위`;
      return {
        id: `row_${rIdx}_${lvl}`,
        levelLabel: lvl,
        rangeName: range,
      };
    });

    return {
      id: secId,
      name: secName,
      role,
      items: generatedItems,
    };
  });
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hanjaSystemData_v9') || localStorage.getItem('hanjaSystemData_v8') || localStorage.getItem(BACKUP_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawLevels = parsed.levels?.length ? parsed.levels : INITIAL_STATE.levels;
        const sortedLevels = sortHanjaLevels(rawLevels);

        const bank = parsed.bank && Object.keys(parsed.bank).length ? parsed.bank : INITIAL_STATE.bank;
        const normalizedLessonData = normalizeLessonData(parsed.lessonData, sortedLevels);
        const quizPool = parsed.quizPool && Object.keys(parsed.quizPool).length > 0 ? { ...INITIAL_STATE.quizPool, ...parsed.quizPool } : INITIAL_STATE.quizPool;

        const sections = ensureSectionItems(parsed.sections, sortedLevels, parsed.sectionPlans || INITIAL_STATE.sectionPlans);

        return {
          ...INITIAL_STATE,
          ...parsed,
          levels: sortedLevels,
          sections,
          bank,
          quizPool,
          lessonData: normalizedLessonData,
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('실시간 자동 백업 완료');

  // Automatic Real-time Auto-Save & Emergency Backup
  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem(BACKUP_KEY, serialized);
      localStorage.setItem(BACKUP_SNAPSHOT_KEY, serialized);
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setAutoSaveStatus(`실시간 자동 저장됨 (${timeStr})`);
    } catch (err) {
      console.warn('Failed to persist to localStorage', err);
      setAutoSaveStatus('저장 오류');
    }
  }, [state]);

  // Window beforeunload listener for guaranteed persistence
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serialized);
        localStorage.setItem(BACKUP_KEY, serialized);
      } catch (e) {
        console.warn('beforeunload save error', e);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
        autoSaveStatus={autoSaveStatus}
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

      {/* Classroom Footer with Auto-Save Badge */}
      <footer className="border-t border-slate-200 bg-white py-3.5 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>한자 학습 보조 관리 시스템 (초·중등 급수별 한자 교육 보조 도구)</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{autoSaveStatus}</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
