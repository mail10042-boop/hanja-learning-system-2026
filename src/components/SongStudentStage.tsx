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

interface Level5CellItem {
  number: number;
  hanjaChar: string;
  hanjaMeaning: string;
  word?: string;
  isClickableSlot: boolean;
}

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

  // Measure 5급 2x5 grid height so 10 questions ALWAYS fit on one screen without scrolling
  const grid5Ref = useRef<HTMLDivElement | null>(null);
  const [grid5Size, setGrid5Size] = useState<{ width: number; height: number }>({
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

  useEffect(() => {
    if (!isLevel5 || !grid5Ref.current || typeof ResizeObserver === 'undefined') return;
    const el = grid5Ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setGrid5Size({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLevel5, showFontControls]);

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

  const lessonObj =
    state.songLessons?.[makeSongLessonId(currentSlot.level, currentSlot.lessonName)] || null;
  const lessonSongs: SongMediaItem[] = getSongMediaList(lessonObj);
  const selectedSongId = overrideSongId || currentSlot.songId;
  const activeMedia: SongMediaItem | null =
    lessonSongs.find((s) => s.id === selectedSongId) || lessonSongs[0] || null;

  const referenceHanjaList = getReferenceHanjaListForLesson(
    state,
    currentSlot.level,
    currentSlot.lessonName
  );

  // Build 10 cells for 5급 2x5 table: prioritize configured slots 1..10, fill any remaining from lesson Hanja
  const level5Cells: Level5CellItem[] = useMemo(() => {
    const cells: Level5CellItem[] = [];
    const usedKeys = new Set<string>();

    // Collect slots 1..10 first
    for (let num = 1; num <= 10; num++) {
      const slot = slotsMap[num];
      if (slot && slot.isConfigured && (slot.hanjaChar || slot.hanjaMeaning)) {
        const key = `${slot.hanjaChar}__${slot.hanjaMeaning}`;
        usedKeys.add(key);
        cells.push({
          number: num,
          hanjaChar: slot.hanjaChar,
          hanjaMeaning: slot.hanjaMeaning,
          word: slot.word,
          isClickableSlot: orderedNumbers.includes(num),
        });
      } else {
        cells.push({
          number: num,
          hanjaChar: '',
          hanjaMeaning: '',
          isClickableSlot: false,
        });
      }
    }

    // Fill any empty cells using referenceHanjaList from current 5급 lesson
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
  }, [slotsMap, orderedNumbers, referenceHanjaList]);

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

  // Auto-fit math for 5급 so all 10 problems (2x5) ALWAYS stay inside one screen without scrolling!
  const rowGap5 = hanjaSize > 64 ? 4 : 8;
  const approxRowH = Math.max(46, (grid5Size.height - rowGap5 * 4) / 5);
  const approxColW = Math.max(180, (grid5Size.width - rowGap5) / 2);
  const fitHanja5 = Math.min(hanjaSize, Math.max(22, Math.floor(approxRowH * 0.66)));
  const fitMeaning5 = Math.min(
    meaningSize,
    Math.max(13, Math.floor(approxRowH * 0.44)),
    Math.floor((approxColW - fitHanja5 - 70) / 5)
  );
  const fitWord5Top = Math.min(wordSize, 64);

  return (
    <div
      className={
        isLevel5
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
          <span>글자 크기 조절 {showFontControls ? '접기' : '열기'}</span>
        </button>
      </div>

      {/* Font Size Slider Controls (Word, Hanja, Meaning independent sliders + +/- + save) */}
      {showFontControls && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2.5 shadow-2xs space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              문제 {currentSlot.slotNumber}번 글자 크기 슬라이더 조절 (즉시 반영·저장)
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
                <span>초기화</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* 1. 출제 가사 크기 Slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-20">
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
              <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-11 text-right shrink-0">
                {wordSize}px
              </span>
            </div>

            {/* 2. 한자 크기 Slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-20">
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
              <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-11 text-right shrink-0">
                {hanjaSize}px
              </span>
            </div>

            {/* 3. 뜻·음 크기 Slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap w-20">
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
              <span className="text-[11px] font-mono font-bold tabular-nums text-slate-800 w-11 text-right shrink-0">
                {meaningSize}px
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE A: 5급 화면 (10문제 2열×5행 도표 한 화면 스크롤 없이 + 위쪽 가사)    */}
      {/* ================================================================= */}
      {isLevel5 ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[68fr_32fr] gap-3 items-stretch">
          {/* Left: Top Lyric Word + 2x5 10-Question Table */}
          <div className="flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs gap-2.5">
            {/* 표 위쪽: 출제자가 입력한 노래 가사 단어 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tabular-nums shrink-0">
                  {currentSlot.slotNumber}번 문제
                </span>
                <span
                  style={{ fontSize: `${fitWord5Top}px`, lineHeight: 1.15 }}
                  className="font-black text-slate-950 tracking-tight break-keep select-none"
                >
                  {currentSlot.word}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                5급 · 10문제 한눈에 보기 (2열 × 5행)
              </span>
            </div>

            {/* 2열 × 5행 10문제 도표 (한 화면에 스크롤 없이 고정 맞춤) */}
            <div
              ref={grid5Ref}
              style={{ gap: `${rowGap5}px` }}
              className="flex-1 min-h-[380px] lg:min-h-0 grid grid-cols-2 grid-rows-5 overflow-hidden"
            >
              {level5Cells.map((cell) => {
                const isCurrentCell = cell.number === currentSlot.slotNumber;
                return (
                  <button
                    key={cell.number}
                    type="button"
                    disabled={!cell.isClickableSlot}
                    onClick={() => {
                      if (cell.isClickableSlot) {
                        setCurrentSlotNum(cell.number);
                      }
                    }}
                    className={`min-h-0 min-w-0 rounded-xl border px-3 py-1 flex items-center justify-between gap-2 text-left overflow-hidden transition ${
                      isCurrentCell
                        ? 'bg-slate-50 border-slate-400'
                        : 'bg-white border-slate-200'
                    } ${cell.isClickableSlot ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                      <span className="text-xs font-mono font-black text-slate-400 tabular-nums w-5 shrink-0">
                        {cell.number}
                      </span>
                      <span
                        style={{ fontSize: `${fitHanja5}px`, lineHeight: 1 }}
                        className="font-black text-slate-950 select-none leading-none shrink-0"
                      >
                        {cell.hanjaChar || '—'}
                      </span>
                    </div>
                    <span
                      style={{ fontSize: `${fitMeaning5}px`, lineHeight: 1.2 }}
                      className="font-bold text-slate-700 text-right break-keep truncate min-w-0"
                    >
                      {cell.hanjaMeaning || ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Compact YouTube/Audio Player + Prev/Next */}
          <div className="flex flex-col justify-between gap-2.5 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs min-h-0">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Music className="w-4 h-4 text-blue-600" />
                  <span>노래 · 동영상 재생</span>
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
        /* MODE B: 8급·7급·6급 화면 (동영상 영역 70% : 문제 출제 영역 30%)          */
        /* ================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 items-stretch">
          {/* LEFT 70%: YouTube Video / Audio Player */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Music className="w-4 h-4 text-blue-600" />
                <span>노래 및 유튜브 동영상 ({currentSlot.level} · {currentSlot.lessonName})</span>
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

          {/* RIGHT 30%: Problem Number + Large Lyric Word + Prev/Next */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-lg font-black text-slate-900 tabular-nums">
                {currentSlot.slotNumber}번 문제
              </span>
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                {currentPos + 1} / {orderedNumbers.length}
              </span>
            </div>

            <div className="flex-1 min-h-[220px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 p-4 text-center">
              <div
                style={{ fontSize: `${wordSize}px`, lineHeight: 1.2 }}
                className="font-black text-slate-950 tracking-tight break-keep select-none"
              >
                {currentSlot.word}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canPrev}
                className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition cursor-pointer ${
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
                className={`flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition cursor-pointer ${
                  canNext
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <span>다음 문제</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
