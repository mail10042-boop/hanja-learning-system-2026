import React, { useEffect, useMemo, useState } from 'react';
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

  // Reference Hanja + Meaning list for this lesson (NEVER highlight the answer Hanja)
  const referenceHanjaList = getReferenceHanjaListForLesson(
    state,
    currentSlot.level,
    currentSlot.lessonName
  );

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

  return (
    <div className="space-y-4">
      {/* Top Bar: Exit, Number Jump Pills, Font Controls Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>수업 종료</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap">
            {orderedNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentSlotNum(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer whitespace-nowrap ${
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
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
            showFontControls
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>글자 크기 설정 {showFontControls ? '접기' : '열기'}</span>
        </button>
      </div>

      {/* Collapsible Independent Font Size Controls (Saved per slot & Apply-to-all) */}
      {showFontControls && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-700">
              문제 {currentSlot.slotNumber}번 글자 크기 독립 조절 (변경 시 자동 저장)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyFontSizesToAllSlots}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <CopyCheck className="w-3.5 h-3.5" />
                <span>{appliedAllFeedback ? '전체 문제에 적용 완료' : '모든 문제에 동일 크기 적용'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetSlotFontSizes}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>기본 크기 초기화</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Problem Word Size */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-800">문제 단어 크기</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {MIN_WORD_FONT_SIZE}~{MAX_WORD_FONT_SIZE}px
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="문제 단어 작게"
                  onClick={() => updateSlotFontSize('wordFontSize', wordSize - 8)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={MIN_WORD_FONT_SIZE}
                  max={MAX_WORD_FONT_SIZE}
                  value={wordSize}
                  onChange={(e) => updateSlotFontSize('wordFontSize', Number(e.target.value))}
                  aria-label="문제 단어 크기 px 입력"
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center text-xs font-mono font-bold tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">px</span>
                <button
                  type="button"
                  aria-label="문제 단어 크게"
                  onClick={() => updateSlotFontSize('wordFontSize', wordSize + 8)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. Hanja Character Size */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-800">한자 크기</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {MIN_HANJA_FONT_SIZE}~{MAX_HANJA_FONT_SIZE}px
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="한자 작게"
                  onClick={() => updateSlotFontSize('hanjaFontSize', hanjaSize - 4)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={MIN_HANJA_FONT_SIZE}
                  max={MAX_HANJA_FONT_SIZE}
                  value={hanjaSize}
                  onChange={(e) => updateSlotFontSize('hanjaFontSize', Number(e.target.value))}
                  aria-label="한자 크기 px 입력"
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center text-xs font-mono font-bold tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">px</span>
                <button
                  type="button"
                  aria-label="한자 크게"
                  onClick={() => updateSlotFontSize('hanjaFontSize', hanjaSize + 4)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. Hun-eum Meaning Size */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-800">음과 뜻 크기</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {MIN_MEANING_FONT_SIZE}~{MAX_MEANING_FONT_SIZE}px
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="음과 뜻 작게"
                  onClick={() => updateSlotFontSize('meaningFontSize', meaningSize - 2)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={MIN_MEANING_FONT_SIZE}
                  max={MAX_MEANING_FONT_SIZE}
                  value={meaningSize}
                  onChange={(e) => updateSlotFontSize('meaningFontSize', Number(e.target.value))}
                  aria-label="음과 뜻 크기 px 입력"
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center text-xs font-mono font-bold tabular-nums"
                />
                <span className="text-xs text-slate-500 font-mono">px</span>
                <button
                  type="button"
                  aria-label="음과 뜻 크게"
                  onClick={() => updateSlotFontSize('meaningFontSize', meaningSize + 2)}
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Split Layout: Left = Question & Hanja Reference, Right = Audio/Video Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Problem Area */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-6">
          {/* Header Row: Problem Number & Level/Lesson */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="text-lg sm:text-xl font-black text-slate-900">
              문제 {currentSlot.slotNumber}
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-600 flex items-center gap-2">
              <span>{currentSlot.level}</span>
              <span aria-hidden="true">·</span>
              <span className="text-blue-700">{currentSlot.lessonName}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 tabular-nums">
                ({currentPos + 1} / {orderedNumbers.length})
              </span>
            </div>
          </div>

          {/* Dragged Target Word Box (Independent wordFontSize) */}
          <div className="min-h-[160px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 px-5 py-8 text-center">
            <div
              style={{ fontSize: `${wordSize}px`, lineHeight: 1.2 }}
              className="font-black text-slate-950 tracking-tight break-keep select-none"
            >
              {currentSlot.word}
            </div>
          </div>

          {/* Reference Hanja + Hun-eum List (Strictly NO answer highlighting) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500">
              {currentSlot.level} {currentSlot.lessonName} 한자 참고 목록 (화이트보드에 알맞은 한자를 써 보세요)
            </div>

            {referenceHanjaList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                이 과에 등록된 한자 정보가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {referenceHanjaList.map((entry, idx) => (
                  <div
                    key={`${entry.hanjaChar}_${entry.hanjaMeaning}_${idx}`}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 flex flex-col items-center justify-center text-center gap-1"
                  >
                    {entry.hanjaChar && (
                      <div
                        style={{ fontSize: `${hanjaSize}px`, lineHeight: 1.15 }}
                        className="font-bold text-slate-900 select-none"
                      >
                        {entry.hanjaChar}
                      </div>
                    )}
                    {entry.hanjaMeaning && (
                      <div
                        style={{ fontSize: `${meaningSize}px`, lineHeight: 1.3 }}
                        className="font-semibold text-slate-700 select-none break-keep"
                      >
                        {entry.hanjaMeaning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Prev / Next Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canPrev}
              className={`flex-1 sm:flex-initial px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                canPrev
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>이전 문제</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext}
              className={`flex-1 sm:flex-initial px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                canNext
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <span>다음 문제</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Song & Video Player Area */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Music className="w-4 h-4 text-blue-600" />
              <span>노래 및 동영상 재생</span>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {currentSlot.level} · {currentSlot.lessonName}
            </span>
          </div>

          {/* If this lesson has multiple songs, let teacher switch seamlessly during class */}
          {lessonSongs.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {lessonSongs.map((s) => {
                const isSel = activeMedia?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOverrideSongId(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer truncate max-w-[180px] ${
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
          />
        </div>
      </div>
    </div>
  );
};
