import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  CopyCheck,
  Music,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Maximize2,
} from 'lucide-react';
import { AppState, SongMediaItem, SongNumberSlot } from '../types';
import { SongAudioPlayer } from './SongAudioPlayer';
import { playBeep } from '../utils/audio';
import {
  clampFontSize,
  DEFAULT_HANJA_FONT_SIZE,
  DEFAULT_MEANING_FONT_SIZE,
  DEFAULT_WORD_FONT_SIZE,
  getReferenceHanjaListForLesson,
  getSongMediaList,
  makeSongLessonId,
  MAX_HANJA_FONT_SIZE,
  MAX_MEANING_FONT_SIZE,
  MAX_WORD_FONT_SIZE,
  MIN_HANJA_FONT_SIZE,
  MIN_MEANING_FONT_SIZE,
  MIN_WORD_FONT_SIZE,
} from '../utils/songHelpers';

interface SongStudentStageProps {
  state: AppState;
  activeSlotNumbers: number[];
  initialSlotNumber?: number;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onExit: () => void;
}

interface TenHanjaCellItem {
  number: number;
  hanjaChar: string;
  hanjaMeaning: string;
  word?: string;
  isClickableSlot: boolean;
}

const VIDEO_WIDTH_STORAGE_KEY = 'hanja_song_video_width_pct';
const GRID_VIDEO_WIDTH_STORAGE_KEY = 'hanja_song_grid_video_width_pct';
const SEMI5_GRID_STORAGE_KEY = 'hanja_song_semi5_show_grid';

export const SongStudentStage: React.FC<SongStudentStageProps> = ({
  state,
  activeSlotNumbers,
  initialSlotNumber,
  onUpdateState,
  onExit,
}) => {
  const slotsMap = state.songNumberSlots || {};

  const orderedNumbers = useMemo(
    () =>
      activeSlotNumbers
        .filter((n) => slotsMap[n]?.isConfigured && slotsMap[n]?.word?.trim())
        .sort((a, b) => a - b),
    [activeSlotNumbers, slotsMap]
  );

  const [currentSlotNum, setCurrentSlotNum] = useState<number>(() => {
    if (initialSlotNumber && orderedNumbers.includes(initialSlotNumber)) {
      return initialSlotNumber;
    }
    return orderedNumbers[0] || 1;
  });

  const [showFontControls, setShowFontControls] = useState<boolean>(true);
  const [appliedAllFeedback, setAppliedAllFeedback] = useState<boolean>(false);
  const [overrideSongId, setOverrideSongId] = useState<string | null>(null);

  // 8급·7급·6급 (and 준5급 when grid OFF): Default 80% video width, resizable 40% ~ 85%
  const [videoWidthPct, setVideoWidthPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(VIDEO_WIDTH_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 40 && saved <= 85) return Math.round(saved);
    } catch {}
    return 80;
  });

  // 5급 (and 준5급 when 10-Hanja grid ON): Side video panel width %, default 32%, resizable 20% ~ 55%
  const [gridVideoPct, setGridVideoPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(GRID_VIDEO_WIDTH_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 20 && saved <= 55) return Math.round(saved);
    } catch {}
    return 32;
  });

  // 준5급 toggle: whether to show 10 Hanja + 뜻·음 below/with selected lyric
  const [showSemi5Grid, setShowSemi5Grid] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SEMI5_GRID_STORAGE_KEY) === 'true';
    } catch {}
    return false;
  });

  // Track desktop (>=1024px) for responsive split sizing
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const updateVideoWidthPct = (next: number) => {
    const clamped = Math.max(40, Math.min(85, Math.round(next)));
    setVideoWidthPct(clamped);
    try {
      localStorage.setItem(VIDEO_WIDTH_STORAGE_KEY, String(clamped));
    } catch {}
  };

  const updateGridVideoPct = (next: number) => {
    const clamped = Math.max(20, Math.min(55, Math.round(next)));
    setGridVideoPct(clamped);
    try {
      localStorage.setItem(GRID_VIDEO_WIDTH_STORAGE_KEY, String(clamped));
    } catch {}
  };

  const toggleSemi5Grid = () => {
    setShowSemi5Grid((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SEMI5_GRID_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  // Drag-resize handler for 8급/7급/6급 split bar
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const startDragResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop || !splitContainerRef.current) return;
    e.preventDefault();
    const rect = splitContainerRef.current.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (rect.width <= 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      updateVideoWidthPct(pct);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Measure 2x5 grid container height so 10 Hanja items ALWAYS fit on one screen without scrolling
  const gridTenRef = useRef<HTMLDivElement | null>(null);
  const [gridTenSize, setGridTenSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 540,
  });

  useEffect(() => {
    if (orderedNumbers.length > 0 && !orderedNumbers.includes(currentSlotNum)) {
      setCurrentSlotNum(orderedNumbers[0]);
    }
  }, [orderedNumbers, currentSlotNum]);

  useEffect(() => {
    setOverrideSongId(null);
  }, [currentSlotNum]);

  const currentPos = orderedNumbers.indexOf(currentSlotNum);
  const currentSlot: SongNumberSlot | null =
    currentPos >= 0 ? slotsMap[currentSlotNum] || null : null;

  const isLevel5 = currentSlot?.level === '5급';
  const isLevelSemi5 = currentSlot?.level === '준5급';
  const showTenGridLayout = isLevel5 || (isLevelSemi5 && showSemi5Grid);

  useEffect(() => {
    if (!showTenGridLayout || !gridTenRef.current || typeof ResizeObserver === 'undefined') return;
    const el = gridTenRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setGridTenSize({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTenGridLayout, showFontControls, gridVideoPct]);

  const canPrev = currentPos > 0;
  const canNext = currentPos >= 0 && currentPos < orderedNumbers.length - 1;

  const handlePrev = () => {
    if (!canPrev) return;
    playBeep(state.soundEnabled, 520, 0.05);
    setCurrentSlotNum(orderedNumbers[currentPos - 1]);
  };

  const handleNext = () => {
    if (!canNext) return;
    playBeep(state.soundEnabled, 660, 0.05);
    setCurrentSlotNum(orderedNumbers[currentPos + 1]);
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft' && canPrev) {
        e.preventDefault();
        setCurrentSlotNum(orderedNumbers[currentPos - 1]);
      } else if (e.key === 'ArrowRight' && canNext) {
        e.preventDefault();
        setCurrentSlotNum(orderedNumbers[currentPos + 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPrev, canNext, orderedNumbers, currentPos]);

  // Update independent font sizes on current slot & persist automatically
  const updateSlotFontSize = (
    field: 'wordFontSize' | 'hanjaFontSize' | 'meaningFontSize',
    value: number
  ) => {
    if (!currentSlot) return;
    const clamped =
      field === 'wordFontSize'
        ? clampFontSize(value, MIN_WORD_FONT_SIZE, MAX_WORD_FONT_SIZE, DEFAULT_WORD_FONT_SIZE)
        : field === 'hanjaFontSize'
        ? clampFontSize(value, MIN_HANJA_FONT_SIZE, MAX_HANJA_FONT_SIZE, DEFAULT_HANJA_FONT_SIZE)
        : clampFontSize(value, MIN_MEANING_FONT_SIZE, MAX_MEANING_FONT_SIZE, DEFAULT_MEANING_FONT_SIZE);

    onUpdateState((prev) => {
      const prevSlots = prev.songNumberSlots || {};
      const existing = prevSlots[currentSlot.slotNumber];
      if (!existing) return prev;
      return {
        ...prev,
        songNumberSlots: {
          ...prevSlots,
          [currentSlot.slotNumber]: {
            ...existing,
            [field]: clamped,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleResetSlotFontSizes = () => {
    if (!currentSlot) return;
    onUpdateState((prev) => {
      const prevSlots = prev.songNumberSlots || {};
      const existing = prevSlots[currentSlot.slotNumber];
      if (!existing) return prev;
      return {
        ...prev,
        songNumberSlots: {
          ...prevSlots,
          [currentSlot.slotNumber]: {
            ...existing,
            wordFontSize: DEFAULT_WORD_FONT_SIZE,
            hanjaFontSize: DEFAULT_HANJA_FONT_SIZE,
            meaningFontSize: DEFAULT_MEANING_FONT_SIZE,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleApplyFontSizesToAllSlots = () => {
    if (!currentSlot) return;
    const { wordFontSize, hanjaFontSize, meaningFontSize } = currentSlot;
    onUpdateState((prev) => {
      const prevSlots = prev.songNumberSlots || {};
      const nextSlots: Record<number, SongNumberSlot> = { ...prevSlots };
      for (let num = 1; num <= 10; num++) {
        if (nextSlots[num]) {
          nextSlots[num] = {
            ...nextSlots[num],
            wordFontSize,
            hanjaFontSize,
            meaningFontSize,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return {
        ...prev,
        songNumberSlots: nextSlots,
      };
    });
    setAppliedAllFeedback(true);
    setTimeout(() => setAppliedAllFeedback(false), 2200);
  };

  const lessonObj = currentSlot
    ? state.songLessons?.[makeSongLessonId(currentSlot.level, currentSlot.lessonName)] || null
    : null;
  const lessonSongs: SongMediaItem[] = getSongMediaList(lessonObj);
  const selectedSongId = overrideSongId || currentSlot?.songId || '';
  const activeMedia: SongMediaItem | null =
    lessonSongs.find((s) => s.id === selectedSongId) || lessonSongs[0] || null;

  const referenceHanjaList = useMemo(
    () =>
      currentSlot
        ? getReferenceHanjaListForLesson(state, currentSlot.level, currentSlot.lessonName)
        : [],
    [state, currentSlot]
  );

  // Build 10 Hanja cells (2x5 grid) for 5급 & 준5급 (matching current grade+lesson, zero answer highlight)
  const tenHanjaCells: TenHanjaCellItem[] = useMemo(() => {
    const cells: TenHanjaCellItem[] = Array.from({ length: 10 }, (_, idx) => ({
      number: idx + 1,
      hanjaChar: '',
      hanjaMeaning: '',
      isClickableSlot: false,
    }));

    if (!currentSlot) return cells;

    const usedKeys = new Set<string>();

    // First place slots 1..10 that belong to the same (level, lessonName)
    for (let num = 1; num <= 10; num++) {
      const slot = slotsMap[num];
      if (
        slot &&
        slot.isConfigured &&
        slot.level === currentSlot.level &&
        slot.lessonName === currentSlot.lessonName &&
        (slot.hanjaChar || slot.hanjaMeaning)
      ) {
        const key = `${slot.hanjaChar}__${slot.hanjaMeaning}`;
        usedKeys.add(key);
        cells[num - 1] = {
          number: num,
          hanjaChar: slot.hanjaChar,
          hanjaMeaning: slot.hanjaMeaning,
          word: slot.word,
          isClickableSlot: orderedNumbers.includes(num),
        };
      }
    }

    // Fill remaining empty cells with current lesson's registered Hanja + 뜻·음
    const remainingRef = referenceHanjaList.filter(
      (r) => !usedKeys.has(`${r.hanjaChar}__${r.hanjaMeaning}`)
    );
    let refCursor = 0;
    for (let i = 0; i < 10; i++) {
      if (!cells[i].hanjaChar && !cells[i].hanjaMeaning && refCursor < remainingRef.length) {
        cells[i].hanjaChar = remainingRef[refCursor].hanjaChar;
        cells[i].hanjaMeaning = remainingRef[refCursor].hanjaMeaning;
        refCursor++;
      }
    }
    return cells;
  }, [slotsMap, orderedNumbers, referenceHanjaList, currentSlot]);

  if (!currentSlot || orderedNumbers.length === 0) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-sm">
        <p className="text-base font-bold text-slate-700">
          출제할 수 있는 지정된 문제가 없습니다. 1~10번 중 하나 이상을 설정해 주세요.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition cursor-pointer"
        >
          오늘의 문제 출제로 돌아가기
        </button>
      </div>
    );
  }

  const wordSize = clampFontSize(
    currentSlot.wordFontSize,
    MIN_WORD_FONT_SIZE,
    MAX_WORD_FONT_SIZE,
    DEFAULT_WORD_FONT_SIZE
  );
  const hanjaSize = clampFontSize(
    currentSlot.hanjaFontSize,
    MIN_HANJA_FONT_SIZE,
    MAX_HANJA_FONT_SIZE,
    DEFAULT_HANJA_FONT_SIZE
  );
  const meaningSize = clampFontSize(
    currentSlot.meaningFontSize,
    MIN_MEANING_FONT_SIZE,
    MAX_MEANING_FONT_SIZE,
    DEFAULT_MEANING_FONT_SIZE
  );

  // Auto-fit math for 2x5 10-Hanja grid so all 10 items stay inside one screen without scrolling!
  const rowGapTen = hanjaSize > 64 ? 4 : 8;
  const approxRowH = Math.max(46, (gridTenSize.height - rowGapTen * 4) / 5);
  const approxColW = Math.max(180, (gridTenSize.width - rowGapTen) / 2);
  const fitHanjaTen = Math.min(hanjaSize, Math.max(22, Math.floor(approxRowH * 0.68)));
  const fitMeaningTen = Math.min(
    meaningSize,
    Math.max(13, Math.floor(approxRowH * 0.44)),
    Math.max(13, Math.floor((approxColW - fitHanjaTen - 68) / 4.5))
  );
  const fitWordTenTop = Math.min(wordSize, 64);

  // When video is wide (e.g. 80%), keep lyric font legible inside the right column without horizontal clipping
  const rightColShare = Math.max(15, 100 - videoWidthPct);
  const fitWordSide =
    isDesktop && rightColShare <= 24 ? Math.min(wordSize, 64) : wordSize;

  return (
    <div
      className={
        showTenGridLayout
          ? 'lg:h-[calc(100vh-118px)] lg:min-h-[580px] flex flex-col gap-2.5 lg:overflow-hidden'
          : 'space-y-3'
      }
    >
      {/* Compact Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>수업 종료</span>
          </button>

          <span className="text-xs font-bold text-slate-500">
            {currentSlot.level} · {currentSlot.lessonName}
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            {orderedNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentSlotNum(num)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer whitespace-nowrap ${
                  num === currentSlot.slotNumber
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {num}번
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 준5급: Toggle button for 10 Hanja + 뜻·음 grid */}
          {isLevelSemi5 && (
            <button
              type="button"
              onClick={toggleSemi5Grid}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                showSemi5Grid
                  ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
            >
              {showSemi5Grid ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>10개 한자·뜻음 {showSemi5Grid ? '숨기기 (가사만)' : '보기'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFontControls((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              showFontControls
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>글자·화면 크기 {showFontControls ? '접기' : '열기'}</span>
          </button>
        </div>
      </div>

      {/* Font Size & Video Size Controls */}
      {showFontControls && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2.5 shadow-2xs space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              문제 {currentSlot.slotNumber}번 글자·동영상 크기 조절 (즉시 반영·저장)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyFontSizesToAllSlots}
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <CopyCheck className="w-3.5 h-3.5" />
                <span>{appliedAllFeedback ? '전체 적용 완료' : '모든 문제에 동일 크기 적용'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetSlotFontSizes}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>글자 초기화</span>
              </button>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-2.5 ${
              showTenGridLayout ? 'md:grid-cols-4' : 'md:grid-cols-2'
            }`}
          >
            {/* 1. 출제 가사 크기 Slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-16">
                출제 가사
              </span>
              <button
                type="button"
                aria-label="출제 가사 작게"
                onClick={() => updateSlotFontSize('wordFontSize', wordSize - 6)}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={MIN_WORD_FONT_SIZE}
                max={MAX_WORD_FONT_SIZE}
                value={wordSize}
                onChange={(e) => updateSlotFontSize('wordFontSize', Number(e.target.value))}
                aria-label="출제 가사 크기 슬라이더"
                className="flex-1 h-1.5 accent-slate-900 cursor-pointer"
              />
              <button
                type="button"
                aria-label="출제 가사 크게"
                onClick={() => updateSlotFontSize('wordFontSize', wordSize + 6)}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-10 text-right shrink-0">
                {wordSize}px
              </span>
            </div>

            {/* 2 & 3. 한자 / 뜻·음 크기 Sliders (visible when 10-grid is active: 5급 or 준5급 ON) */}
            {showTenGridLayout && (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-16">
                    한자 크기
                  </span>
                  <button
                    type="button"
                    aria-label="한자 작게"
                    onClick={() => updateSlotFontSize('hanjaFontSize', hanjaSize - 4)}
                    className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min={MIN_HANJA_FONT_SIZE}
                    max={MAX_HANJA_FONT_SIZE}
                    value={hanjaSize}
                    onChange={(e) => updateSlotFontSize('hanjaFontSize', Number(e.target.value))}
                    aria-label="한자 크기 슬라이더"
                    className="flex-1 h-1.5 accent-blue-700 cursor-pointer"
                  />
                  <button
                    type="button"
                    aria-label="한자 크게"
                    onClick={() => updateSlotFontSize('hanjaFontSize', hanjaSize + 4)}
                    className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-10 text-right shrink-0">
                    {hanjaSize}px
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-16">
                    뜻·음 크기
                  </span>
                  <button
                    type="button"
                    aria-label="뜻과 음 작게"
                    onClick={() => updateSlotFontSize('meaningFontSize', meaningSize - 2)}
                    className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min={MIN_MEANING_FONT_SIZE}
                    max={MAX_MEANING_FONT_SIZE}
                    value={meaningSize}
                    onChange={(e) => updateSlotFontSize('meaningFontSize', Number(e.target.value))}
                    aria-label="뜻과 음 크기 슬라이더"
                    className="flex-1 h-1.5 accent-emerald-700 cursor-pointer"
                  />
                  <button
                    type="button"
                    aria-label="뜻과 음 크게"
                    onClick={() => updateSlotFontSize('meaningFontSize', meaningSize + 2)}
                    className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-10 text-right shrink-0">
                    {meaningSize}px
                  </span>
                </div>
              </>
            )}

            {/* Video Width Slider (works in both modes!) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-16">
                동영상 폭
              </span>
              <button
                type="button"
                aria-label="동영상 줄이기"
                onClick={() =>
                  showTenGridLayout
                    ? updateGridVideoPct(gridVideoPct - 4)
                    : updateVideoWidthPct(videoWidthPct - 5)
                }
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={showTenGridLayout ? 20 : 40}
                max={showTenGridLayout ? 55 : 85}
                value={showTenGridLayout ? gridVideoPct : videoWidthPct}
                onChange={(e) =>
                  showTenGridLayout
                    ? updateGridVideoPct(Number(e.target.value))
                    : updateVideoWidthPct(Number(e.target.value))
                }
                aria-label="동영상 너비 슬라이더"
                className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
              />
              <button
                type="button"
                aria-label="동영상 넓히기"
                onClick={() =>
                  showTenGridLayout
                    ? updateGridVideoPct(gridVideoPct + 4)
                    : updateVideoWidthPct(videoWidthPct + 5)
                }
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[11px] font-mono font-bold tabular-nums text-blue-800 w-10 text-right shrink-0">
                {showTenGridLayout ? `${gridVideoPct}%` : `${videoWidthPct}%`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE A: 5급 & 준5급(10개 보기 ON) — 가사 + 10개 한자·뜻음 격자 (2열×5행)  */}
      {/* ================================================================= */}
      {showTenGridLayout ? (
        <div
          className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 items-stretch"
        >
          {/* Main Left Area: Top Selected Lyric Word + 2x5 10 Hanja & Meaning Grid */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs gap-2.5">
            {/* Top: Teacher-selected lyric word */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tabular-nums shrink-0">
                  {currentSlot.slotNumber}번 문제
                </span>
                <span
                  style={{ fontSize: `${fitWordTenTop}px`, lineHeight: 1.15 }}
                  className="font-black text-slate-950 tracking-tight break-keep select-none"
                >
                  {currentSlot.word}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                {currentSlot.level} · 10개 한자·뜻음 격자 (2열 × 5행)
              </span>
            </div>

            {/* 2열 × 5행 10개 한자·뜻·음 격자 (한 화면에 스크롤 없이 공간 활용 극대화) */}
            <div
              ref={gridTenRef}
              style={{ gap: `${rowGapTen}px` }}
              className="flex-1 min-h-[380px] lg:min-h-0 grid grid-cols-2 grid-rows-5 overflow-hidden"
            >
              {tenHanjaCells.map((cell) => (
                <button
                  key={cell.number}
                  type="button"
                  disabled={!cell.isClickableSlot}
                  onClick={() => {
                    if (cell.isClickableSlot) {
                      setCurrentSlotNum(cell.number);
                    }
                  }}
                  className={`min-h-0 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-1 flex items-center justify-between gap-2 text-left overflow-hidden transition ${
                    cell.isClickableSlot ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                    <span className="text-xs font-mono font-black text-slate-400 tabular-nums w-5 shrink-0">
                      {cell.number}
                    </span>
                    <span
                      style={{ fontSize: `${fitHanjaTen}px`, lineHeight: 1 }}
                      className="font-black text-slate-950 select-none leading-none shrink-0"
                    >
                      {cell.hanjaChar || '—'}
                    </span>
                  </div>
                  <span
                    style={{ fontSize: `${fitMeaningTen}px`, lineHeight: 1.2 }}
                    className="font-bold text-slate-700 text-right break-keep truncate min-w-0"
                  >
                    {cell.hanjaMeaning || ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Area: Resizable Compact YouTube/Audio Player + Prev/Next */}
          <div
            style={isDesktop ? { width: `${gridVideoPct}%` } : undefined}
            className="shrink-0 flex flex-col justify-between gap-2.5 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs min-h-0"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Music className="w-4 h-4 text-blue-600" />
                  <span>노래 · 동영상 ({gridVideoPct}%)</span>
                </div>
                {lessonSongs.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {lessonSongs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setOverrideSongId(s.id)}
                        className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer truncate max-w-[110px] ${
                          activeMedia?.id === s.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <SongAudioPlayer
                media={activeMedia}
                lesson={lessonObj}
                startTimeOverride={
                  overrideSongId ? activeMedia?.startTime : currentSlot.startTime
                }
                endTimeOverride={
                  overrideSongId ? activeMedia?.endTime ?? null : currentSlot.endTime
                }
                variant="student"
                layoutSize="compact"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canPrev}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  canPrev
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                    : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>이전 문제</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  canNext
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <span>다음 문제</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* MODE B: 8급·7급·6급 & 준5급(가사만 보기) — 기본 80% 동영상 + 가사만  */
        /* ================================================================= */
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-3 lg:gap-0 items-stretch"
        >
          {/* LEFT (Default 80%, Resizable 40% ~ 85%): YouTube Video / Audio Player */}
          <div
            style={isDesktop ? { width: `${videoWidthPct}%` } : undefined}
            className="shrink-0 bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Music className="w-4 h-4 text-blue-600" />
                <span>
                  노래 · 동영상 ({currentSlot.level} · {currentSlot.lessonName})
                </span>
              </div>

              {/* Quick Inline Video Width Resize Bar */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600">동영상 크기</span>
                <button
                  type="button"
                  onClick={() => updateVideoWidthPct(videoWidthPct - 5)}
                  className="p-0.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="동영상 줄이기"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[11px] font-mono font-bold tabular-nums text-blue-700 w-9 text-center">
                  {videoWidthPct}%
                </span>
                <button
                  type="button"
                  onClick={() => updateVideoWidthPct(videoWidthPct + 5)}
                  className="p-0.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="동영상 넓히기"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {videoWidthPct !== 80 && (
                  <button
                    type="button"
                    onClick={() => updateVideoWidthPct(80)}
                    className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold cursor-pointer"
                  >
                    80%
                  </button>
                )}
              </div>

              {lessonSongs.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {lessonSongs.map((s) => {
                    const isSel = activeMedia?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setOverrideSongId(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer truncate max-w-[160px] ${
                          isSel
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title={s.title}
                      >
                        {s.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <SongAudioPlayer
              media={activeMedia}
              lesson={lessonObj}
              startTimeOverride={
                overrideSongId ? activeMedia?.startTime : currentSlot.startTime
              }
              endTimeOverride={
                overrideSongId ? activeMedia?.endTime ?? null : currentSlot.endTime
              }
              variant="student"
              layoutSize="hero"
            />
          </div>

          {/* Desktop Draggable Divider Handle */}
          {isDesktop && (
            <div
              onPointerDown={startDragResize}
              title="좌우로 드래그하여 동영상 크기를 조절하세요"
              className="w-3 shrink-0 cursor-col-resize flex items-center justify-center group select-none"
            >
              <div className="w-1 h-16 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
            </div>
          )}

          {/* RIGHT (Default 20%, Resizable 15% ~ 60%): ONLY Problem Number + Teacher-Selected Lyric Word */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-2.5">
              <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums whitespace-nowrap">
                {currentSlot.slotNumber}번 문제
              </span>
              <span className="text-xs font-bold text-slate-500 tabular-nums whitespace-nowrap">
                {currentPos + 1} / {orderedNumbers.length}
              </span>
            </div>

            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 p-3 text-center overflow-hidden gap-3">
              <div
                style={{ fontSize: `${fitWordSide}px`, lineHeight: 1.2 }}
                className="font-black text-slate-950 tracking-tight break-keep select-none max-w-full"
              >
                {currentSlot.word}
              </div>

              {isLevelSemi5 && (
                <button
                  type="button"
                  onClick={toggleSemi5Grid}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>10개 한자·뜻음 보기</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canPrev}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  canPrev
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                    : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>이전</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  canNext
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <span>다음</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
