import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LessonScreen } from './components/LessonScreen';
import { QuizScreen } from './components/QuizScreen';
import { AdminScreen } from './components/AdminScreen';
import { FloatingTimer } from './components/FloatingTimer';
import { AppState, ActiveTab } from './types';
import { INITIAL_STATE } from './data/initialData';
import { sortHanjaLevels } from './utils/levelOrder';

const PRIMARY_STORAGE_KEY = 'hanjaSystemData_v12_primary';
const STORAGE_KEYS_TO_TRY = [
  PRIMARY_STORAGE_KEY,
  'hanjaSystemData_live',
  'hanjaSystemData_v11',
  'hanjaSystemData_backup',
  'hanjaSystemData_snapshot',
];
const BACKUP_KEY = 'hanjaSystemData_backup';
const BACKUP_SNAPSHOT_KEY = 'hanjaSystemData_snapshot';

// Helper to ensure section items have baseLevel and levelLabel
function ensureSectionItems(sections: any[], sortedLevels: string[], defaultPlans?: Record<string, string[]>) {
  const safeSortedLevels = sortedLevels.length > 0 ? sortedLevels : ['8급'];
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return (INITIAL_STATE.sections || []).map((sec) => ({
      ...sec,
      items: (sec.items || []).map((item: any, idx: number) => {
        const fallbackLevel = safeSortedLevels[idx % safeSortedLevels.length] || '8급';
        return {
          ...item,
          levelLabel: item?.levelLabel || item?.baseLevel || fallbackLevel,
          baseLevel: item?.baseLevel || item?.levelLabel || fallbackLevel,
        };
      }),
    }));
  }

  return sections.map((sec) => {
    const rawItems = Array.isArray(sec.items) ? sec.items : [];
    const sanitizedItems = rawItems.map((item: any, idx: number) => {
      const fallbackLevel = safeSortedLevels[idx % safeSortedLevels.length] || '8급';
      const bLvl = item?.baseLevel || item?.levelLabel || fallbackLevel;
      const lLabel = item?.levelLabel || item?.baseLevel || bLvl;
      return {
        ...item,
        id: item?.id || `item_${Date.now()}_${idx}`,
        levelLabel: lLabel,
        baseLevel: bLvl,
        rangeName: typeof item?.rangeName === 'string' ? item.rangeName : '',
      };
    });
    return {
      ...sec,
      items: sanitizedItems,
    };
  });
}

function normalizeLessonData(data: any, sortedLevels: string[]) {
  if (!data || typeof data !== 'object') return INITIAL_STATE.lessonData;
  const result: Record<string, any> = { ...INITIAL_STATE.lessonData, ...data };
  sortedLevels.forEach((lvl) => {
    if (!result[lvl]) {
      result[lvl] = {
        level: lvl,
        todayRange: '',
        prob1: '',
        prob2: '',
        prob3: '',
        prob4: '',
      };
    }
  });
  return result;
}

function parseAndSanitizeState(parsed: any): AppState {
  if (!parsed || typeof parsed !== 'object') return INITIAL_STATE;
  const rawLevels = parsed.levels?.length ? parsed.levels : INITIAL_STATE.levels;
  const sortedLevels = sortHanjaLevels(rawLevels);

  const bank = parsed.bank && Object.keys(parsed.bank).length ? parsed.bank : INITIAL_STATE.bank;
  const bankRangeOrder = parsed.bankRangeOrder && typeof parsed.bankRangeOrder === 'object' ? parsed.bankRangeOrder : (INITIAL_STATE.bankRangeOrder || {});
  const normalizedLessonData = normalizeLessonData(parsed.lessonData, sortedLevels);
  const quizPool = parsed.quizPool && Object.keys(parsed.quizPool).length > 0 ? { ...INITIAL_STATE.quizPool, ...parsed.quizPool } : INITIAL_STATE.quizPool;

  const sections = ensureSectionItems(parsed.sections, sortedLevels, parsed.sectionPlans || INITIAL_STATE.sectionPlans);

  return {
    ...INITIAL_STATE,
    ...parsed,
    levels: sortedLevels,
    sections,
    bank,
    bankRangeOrder,
    quizPool,
    lessonData: normalizedLessonData,
    hiddenLevels: Array.isArray(parsed.hiddenLevels) ? parsed.hiddenLevels : [],
  };
}

function loadSavedState(): AppState {
  try {
    for (const key of STORAGE_KEYS_TO_TRY) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return parseAndSanitizeState(parsed);
          }
        } catch {
          // continue checking next key
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load local storage state', err);
  }
  return INITIAL_STATE;
}

export default function App() {
  const [state, setState] = useState<AppState>(loadSavedState);
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('lesson');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [showFloatingTimer, setShowFloatingTimer] = useState<boolean>(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('클라우드 실시간 동기화 연결 중...');

  // Track unique client session ID so this device doesn't overwrite its own active typing updates
  const myClientIdRef = useRef<string>(`client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const isSelfSavingRef = useRef<boolean>(false);

  // 1. Initial Cloud State Fetch on App Boot
  useEffect(() => {
    let isMounted = true;
    async function syncFromCloud() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.exists && data.state && isMounted) {
            const sanitized = parseAndSanitizeState(data.state);
            setState(sanitized);
            setAutoSaveStatus('클라우드 실시간 자동 연동 완료 (모든 PC/태블릿)');
            setIsCloudLoaded(true);
            return;
          } else if (data.success && !data.exists) {
            // Seed cloud storage with initial state
            const currentLocal = loadSavedState();
            await fetch('/api/state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: currentLocal, clientId: myClientIdRef.current }),
            });
            if (isMounted) {
              setAutoSaveStatus('클라우드 초기 동기화 완료');
            }
          }
        }
      } catch (err) {
        console.warn('Initial server state fetch failed, fallback to local storage:', err);
        if (isMounted) {
          setAutoSaveStatus('로컬 데이터 사용 중 (오프라인)');
        }
      } finally {
        if (isMounted) {
          setIsCloudLoaded(true);
        }
      }
    }
    syncFromCloud();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-Time Server-Sent Events (SSE) Cross-Device Live Broadcast Listener
  // When another iPad, Samsung tablet, or PC edits a problem/curriculum, this instant stream updates automatically!
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/state/stream');

        eventSource.onopen = () => {
          setAutoSaveStatus('실시간 클라우드 자동 동기화 ON');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CONNECTED') {
              // Connected successfully to live sync stream
            } else if (data.type === 'STATE_UPDATED' && data.state) {
              // Ignore if broadcast is from this same device's recent save
              if (data.senderClientId && data.senderClientId === myClientIdRef.current) {
                return;
              }

              // Update state instantly from remote computer/tablet change
              const sanitized = parseAndSanitizeState(data.state);
              setState(sanitized);
              setAutoSaveStatus('다른 기기에서 실시간 동기화됨');
            }
          } catch (e) {
            console.warn('SSE message parse error', e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
          }
          // Attempt graceful reconnect after 4 seconds
          reconnectTimeout = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.warn('EventSource initialization error', err);
      }
    }

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // 3. Real-time Local Storage + Cloud Auto-Save
  useEffect(() => {
    // Immediate local storage persistence
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
      localStorage.setItem('hanjaSystemData_live', serialized);
      localStorage.setItem('hanjaSystemData_v11', serialized);
      localStorage.setItem(BACKUP_KEY, serialized);
      localStorage.setItem(BACKUP_SNAPSHOT_KEY, serialized);
    } catch (err) {
      console.warn('Failed to persist to localStorage', err);
    }

    if (!isCloudLoaded) return;

    // Debounced automatic Cloud upload & multi-device broadcast
    const syncTimer = setTimeout(async () => {
      try {
        isSelfSavingRef.current = true;
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, clientId: myClientIdRef.current }),
        });
        if (res.ok) {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          setAutoSaveStatus(`클라우드 실시간 동기화됨 (${timeStr})`);
        }
      } catch (err) {
        console.warn('Cloud sync error:', err);
      } finally {
        isSelfSavingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(syncTimer);
  }, [state, isCloudLoaded]);

  // Window beforeunload listener for guaranteed synchronous persistence
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
        localStorage.setItem('hanjaSystemData_live', serialized);
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased selection:bg-blue-600 selection:text-white pb-16">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminAuthenticated={isAdminAuthenticated}
        setIsAdminAuthenticated={setIsAdminAuthenticated}
        autoSaveStatus={autoSaveStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1750px] mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6">
        {activeTab === 'lesson' && <LessonScreen state={state} onUpdateState={setState} />}
        {activeTab === 'quiz' && <QuizScreen state={state} onUpdateState={setState} />}
        {activeTab === 'admin' && (
          <AdminScreen
            state={state}
            onUpdateState={setState}
            isAdminAuthenticated={isAdminAuthenticated}
            setIsAdminAuthenticated={setIsAdminAuthenticated}
          />
        )}
      </main>

      {/* Global Floating Timer overlay */}
      {showFloatingTimer && (
        <FloatingTimer
          durationMinutes={state.timerMinutes || 10}
          onClose={() => setShowFloatingTimer(false)}
        />
      )}
    </div>
  );
}
