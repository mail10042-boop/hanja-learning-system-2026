import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Check,
  Trash2,
  Save,
  Music,
  Youtube,
  Hand,
  MousePointerClick,
  BookOpen,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  AppState,
  SongHanjaLyricItem,
  SongMediaItem,
  SongNumberSlot,
} from '../types';
import {
  createEmptyNumberSlot,
  DEFAULT_HANJA_FONT_SIZE,
  DEFAULT_MEANING_FONT_SIZE,
  DEFAULT_WORD_FONT_SIZE,
  getLessonSongHanjaLyrics,
  getManagedLessonsForLevel,
  getSongMediaList,
  makeSongLessonId,
  PRIMARY_SONG_LEVELS,
} from '../utils/songHelpers';
import { playBeep } from '../utils/audio';

interface SongTodayBuilderProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onStartClass: (activeNumbers: number[], initialSlotNumber?: number) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const SLOT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const SongTodayBuilder: React.FC<SongTodayBuilderProps> = ({
  state,
  onUpdateState,
  onStartClass,
  onNotify,
}) => {
  const slotsMap = state.songNumberSlots || {};

  // Active slot being edited (1..10)
  const [editingSlotNum, setEditingSlotNum] = useState<number>(1);

  // Draft values inside editor for selected slot
  const [draftLevel, setDraftLevel] = useState<string>('8급');
  const [draftLessonName, setDraftLessonName] = useState<string>('1과');
  const [draftSongId, setDraftSongId] = useState<string>('');
  const [draftLyricItemId, setDraftLyricItemId] = useState<string>('');
  const [draftFullLyric, setDraftFullLyric] = useState<string>('');
  const [draftWord, setDraftWord] = useState<string>('');
  const [draftStartOffset, setDraftStartOffset] = useState<number>(0);
  const [draftEndOffset, setDraftEndOffset] = useState<number>(0);
  const [draftHanjaChar, setDraftHanjaChar] = useState<string>('');
  const [draftHanjaMeaning, setDraftHanjaMeaning] = useState<string>('');
  const [draftStartTime, setDraftStartTime] = useState<number>(0);
  const [draftEndTime, setDraftEndTime] = useState<number | null>(null);
  const [draftEnabled, setDraftEnabled] = useState<boolean>(true);
  const [showAllLevels, setShowAllLevels] = useState<boolean>(false);

  // Touch / Mobile 2-tap fallback per lyric row
  const [touchTapRowId, setTouchTapRowId] = useState<string | null>(null);
  const [touchAnchorIdx, setTouchAnchorIdx] = useState<number | null>(null);

  // Native selection tracking on mobile/tablet long-press
  const activeLyricRefMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingNativeSel, setPendingNativeSel] = useState<{
    lyricItem: SongHanjaLyricItem;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  // Load slot settings when clicking a slot button 1..10
  useEffect(() => {
    const existing = slotsMap[editingSlotNum];
    if (existing && existing.isConfigured) {
      setDraftLevel(existing.level || '8급');
      setDraftLessonName(existing.lessonName || '1과');
      setDraftSongId(existing.songId || '');
      setDraftLyricItemId(existing.lyricItemId || '');
      setDraftFullLyric(existing.fullLyric || '');
      setDraftWord(existing.word || '');
      setDraftStartOffset(existing.startOffset || 0);
      setDraftEndOffset(existing.endOffset || 0);
      setDraftHanjaChar(existing.hanjaChar || '');
      setDraftHanjaMeaning(existing.hanjaMeaning || '');
      setDraftStartTime(Number(existing.startTime) || 0);
      setDraftEndTime(existing.endTime ?? null);
      setDraftEnabled(existing.enabled !== false);
    } else {
      // Keep current level/lesson or default to first registered lesson
      setDraftLyricItemId('');
      setDraftFullLyric('');
      setDraftWord('');
      setDraftStartOffset(0);
      setDraftEndOffset(0);
      setDraftHanjaChar('');
      setDraftHanjaMeaning('');
      setDraftEnabled(true);
    }
    setPendingNativeSel(null);
    setTouchTapRowId(null);
    setTouchAnchorIdx(null);
  }, [editingSlotNum]);

  const otherLevels = useMemo(
    () =>
      state.levels.filter(
        (lvl) => !(PRIMARY_SONG_LEVELS as readonly string[]).includes(lvl)
      ),
    [state.levels]
  );

  const lessonsForDraftLevel = useMemo(
    () => getManagedLessonsForLevel(state, draftLevel),
    [state, draftLevel]
  );

  // Ensure draftLessonName stays valid when draftLevel changes
  useEffect(() => {
    if (lessonsForDraftLevel.length > 0 && !lessonsForDraftLevel.includes(draftLessonName)) {
      setDraftLessonName(lessonsForDraftLevel[0]);
    } else if (lessonsForDraftLevel.length === 0 && draftLessonName !== '') {
      setDraftLessonName('');
    }
  }, [draftLevel, lessonsForDraftLevel, draftLessonName]);

  const currentDraftLessonObj =
    state.songLessons?.[makeSongLessonId(draftLevel, draftLessonName)] || null;
  const availableSongs: SongMediaItem[] = useMemo(
    () => getSongMediaList(currentDraftLessonObj),
    [currentDraftLessonObj]
  );
  const availableHanjaLyrics: SongHanjaLyricItem[] = useMemo(
    () => getLessonSongHanjaLyrics(currentDraftLessonObj),
    [currentDraftLessonObj]
  );

  // Auto-select first song of lesson if none selected or song not in this lesson
  useEffect(() => {
    if (availableSongs.length === 0) {
      setDraftSongId('');
      setDraftStartTime(0);
      setDraftEndTime(null);
      return;
    }
    const found = availableSongs.find((s) => s.id === draftSongId);
    if (!found) {
      const first = availableSongs[0];
      setDraftSongId(first.id);
      setDraftStartTime(Number(first.startTime) || 0);
      setDraftEndTime(first.endTime ?? null);
    }
  }, [availableSongs, draftSongId]);

  const applySelectionToDraft = (
    lyricItem: SongHanjaLyricItem,
    wordText: string,
    startOffset: number,
    endOffset: number
  ) => {
    const cleanWord = wordText.trim();
    if (!cleanWord) return;
    playBeep(state.soundEnabled, 700, 0.05);
    setDraftLyricItemId(lyricItem.id);
    setDraftFullLyric(lyricItem.lyricLine);
    setDraftWord(cleanWord);
    setDraftStartOffset(startOffset);
    setDraftEndOffset(endOffset);
    setDraftHanjaChar(lyricItem.hanjaChar);
    setDraftHanjaMeaning(lyricItem.hanjaMeaning);
    setPendingNativeSel(null);
    window.getSelection()?.removeAllRanges();
  };

  // Detect mouseup / selection on any lyric row
  const handleLyricMouseUp = (lyricItem: SongHanjaLyricItem) => {
    const container = activeLyricRefMap.current[lyricItem.id];
    if (!container) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    const preStart = document.createRange();
    preStart.selectNodeContents(container);
    preStart.setEnd(range.startContainer, range.startOffset);
    const startLen = (preStart.toString() || '').length;

    const preEnd = document.createRange();
    preEnd.selectNodeContents(container);
    preEnd.setEnd(range.endContainer, range.endOffset);
    const endLen = (preEnd.toString() || '').length;

    const start = Math.min(startLen, endLen);
    const end = Math.max(startLen, endLen);
    const rawText = lyricItem.lyricLine.slice(start, end);
    const trimmed = rawText.trim();
    if (trimmed.length > 0) {
      applySelectionToDraft(lyricItem, trimmed, start, end);
    }
  };

  // Track mobile/tablet native long-press selectionchange
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      for (const lyricItem of availableHanjaLyrics) {
        const container = activeLyricRefMap.current[lyricItem.id];
        if (container && container.contains(range.commonAncestorContainer)) {
          const preStart = document.createRange();
          preStart.selectNodeContents(container);
          preStart.setEnd(range.startContainer, range.startOffset);
          const s = (preStart.toString() || '').length;

          const preEnd = document.createRange();
          preEnd.selectNodeContents(container);
          preEnd.setEnd(range.endContainer, range.endOffset);
          const e = (preEnd.toString() || '').length;

          const start = Math.min(s, e);
          const end = Math.max(s, e);
          const txt = lyricItem.lyricLine.slice(start, end).trim();
          if (txt.length > 0) {
            setPendingNativeSel({
              lyricItem,
              text: txt,
              startOffset: start,
              endOffset: end,
            });
          }
          break;
        }
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [availableHanjaLyrics]);

  // Mobile 2-tap character range selector
  const handleTouchCharTap = (lyricItem: SongHanjaLyricItem, charIdx: number) => {
    if (touchTapRowId !== lyricItem.id || touchAnchorIdx === null) {
      setTouchTapRowId(lyricItem.id);
      setTouchAnchorIdx(charIdx);
      return;
    }
    const start = Math.min(touchAnchorIdx, charIdx);
    const end = Math.max(touchAnchorIdx, charIdx) + 1;
    const picked = lyricItem.lyricLine.slice(start, end).trim();
    setTouchAnchorIdx(null);
    setTouchTapRowId(null);
    if (picked) {
      applySelectionToDraft(lyricItem, picked, start, end);
    }
  };

  const handleSaveSlot = () => {
    if (!draftWord.trim()) {
      onNotify('가사에서 출제할 단어를 드래그하거나 직접 입력해 주세요.', 'error');
      return;
    }
    const selectedSong = availableSongs.find((s) => s.id === draftSongId) || availableSongs[0];
    const prevSlot = slotsMap[editingSlotNum];

    const updatedSlot: SongNumberSlot = {
      slotNumber: editingSlotNum,
      isConfigured: true,
      enabled: draftEnabled,
      level: draftLevel,
      lessonName: draftLessonName,
      songId: selectedSong?.id || '',
      songTitle: selectedSong?.title || '',
      lyricItemId: draftLyricItemId,
      fullLyric: draftFullLyric,
      word: draftWord.trim(),
      startOffset: draftStartOffset,
      endOffset: draftEndOffset,
      hanjaChar: draftHanjaChar.trim(),
      hanjaMeaning: draftHanjaMeaning.trim(),
      startTime: Number(draftStartTime) || 0,
      endTime: draftEndTime,
      wordFontSize: prevSlot?.wordFontSize || DEFAULT_WORD_FONT_SIZE,
      hanjaFontSize: prevSlot?.hanjaFontSize || DEFAULT_HANJA_FONT_SIZE,
      meaningFontSize: prevSlot?.meaningFontSize || DEFAULT_MEANING_FONT_SIZE,
      updatedAt: new Date().toISOString(),
    };

    onUpdateState((prev) => ({
      ...prev,
      songNumberSlots: {
        ...(prev.songNumberSlots || {}),
        [editingSlotNum]: updatedSlot,
      },
    }));

    playBeep(state.soundEnabled, 840, 0.06);
    onNotify(`문제 ${editingSlotNum}번 (${updatedSlot.level} ${updatedSlot.lessonName} · "${updatedSlot.word}")이 저장되었습니다.`);
  };

  const handleToggleSlotEnabled = (slotNum: number) => {
    const existing = slotsMap[slotNum];
    if (!existing || !existing.isConfigured) return;
    onUpdateState((prev) => ({
      ...prev,
      songNumberSlots: {
        ...(prev.songNumberSlots || {}),
        [slotNum]: {
          ...existing,
          enabled: !existing.enabled,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    if (slotNum === editingSlotNum) {
      setDraftEnabled(!existing.enabled);
    }
  };

  const handleClearSlot = (slotNum: number) => {
    onUpdateState((prev) => {
      const next = { ...(prev.songNumberSlots || {}) };
      next[slotNum] = createEmptyNumberSlot(slotNum);
      return { ...prev, songNumberSlots: next };
    });
    if (slotNum === editingSlotNum) {
      setDraftWord('');
      setDraftFullLyric('');
      setDraftHanjaChar('');
      setDraftHanjaMeaning('');
      setDraftLyricItemId('');
    }
    onNotify(`문제 ${slotNum}번 설정이 초기화되었습니다.`);
  };

  const configuredSlotsList = useMemo(
    () =>
      SLOT_NUMBERS.map((n) => slotsMap[n]).filter(
        (s): s is SongNumberSlot => Boolean(s && s.isConfigured && s.word?.trim())
      ),
    [slotsMap]
  );

  const activeNumbersToTeach = useMemo(
    () =>
      configuredSlotsList
        .filter((s) => s.enabled !== false)
        .map((s) => s.slotNumber),
    [configuredSlotsList]
  );

  const handleEnableAllConfigured = (enable: boolean) => {
    onUpdateState((prev) => {
      const prevSlots = prev.songNumberSlots || {};
      const nextSlots = { ...prevSlots };
      SLOT_NUMBERS.forEach((n) => {
        if (nextSlots[n]?.isConfigured) {
          nextSlots[n] = { ...nextSlots[n], enabled: enable };
        }
      });
      return { ...prev, songNumberSlots: nextSlots };
    });
  };

  // One-click fill slots 1..10 using the currently selected grade & lesson's Hanja lyrics
  const handleAutoFillSlotsFromDraftLesson = () => {
    if (availableHanjaLyrics.length === 0) {
      onNotify(`[${draftLevel} ${draftLessonName}]에 등록된 한자별 노래 가사가 없습니다.`, 'error');
      return;
    }
    const chosenSong = availableSongs.find((s) => s.id === draftSongId) || availableSongs[0];
    onUpdateState((prev) => {
      const prevSlots = prev.songNumberSlots || {};
      const nextSlots: Record<number, SongNumberSlot> = { ...prevSlots };
      const count = Math.min(10, availableHanjaLyrics.length);
      for (let i = 0; i < count; i++) {
        const slotNum = i + 1;
        const item = availableHanjaLyrics[i];
        const prevSlot = nextSlots[slotNum];
        nextSlots[slotNum] = {
          slotNumber: slotNum,
          isConfigured: true,
          enabled: true,
          level: draftLevel,
          lessonName: draftLessonName,
          songId: chosenSong?.id || '',
          songTitle: chosenSong?.title || '',
          lyricItemId: item.id,
          fullLyric: item.lyricLine,
          word: item.lyricLine || item.hanjaMeaning || item.hanjaChar,
          startOffset: 0,
          endOffset: (item.lyricLine || '').length,
          hanjaChar: item.hanjaChar,
          hanjaMeaning: item.hanjaMeaning,
          startTime: Number(chosenSong?.startTime) || 0,
          endTime: chosenSong?.endTime ?? null,
          wordFontSize: prevSlot?.wordFontSize || DEFAULT_WORD_FONT_SIZE,
          hanjaFontSize: prevSlot?.hanjaFontSize || DEFAULT_HANJA_FONT_SIZE,
          meaningFontSize: prevSlot?.meaningFontSize || DEFAULT_MEANING_FONT_SIZE,
          updatedAt: new Date().toISOString(),
        };
      }
      return { ...prev, songNumberSlots: nextSlots };
    });
    onNotify(`[${draftLevel} ${draftLessonName}] 가사 ${Math.min(10, availableHanjaLyrics.length)}개로 1~${Math.min(10, availableHanjaLyrics.length)}번이 자동 채워졌습니다.`);
  };

  return (
    <div className="space-y-5">
      {/* Section 1: 1~10번 문제 번호 선택 버튼 그리드 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              1. 오늘의 문제 번호 선택 (1~10번)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              번호를 클릭하여 급수·과·노래·출제 단어를 지정하세요. 원하는 번호만 골라서(예: 1번만, 2·5·8번, 3~7번) 수업할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleEnableAllConfigured(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              지정 문제 전체 포함
            </button>
            <button
              type="button"
              onClick={() => handleEnableAllConfigured(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              전체 출제 제외
            </button>
            <button
              type="button"
              disabled={activeNumbersToTeach.length === 0}
              onClick={() => onStartClass(activeNumbersToTeach, activeNumbersToTeach[0])}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-sm font-bold flex items-center gap-2 shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>수업 시작 ({activeNumbersToTeach.length}문제)</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
            <span>지정 완료 · 오늘 출제 포함</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
            <span>지정 완료 · 오늘 수업 제외</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300 inline-block" />
            <span>미지정</span>
          </span>
        </div>

        {/* 1~10 Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {SLOT_NUMBERS.map((num) => {
            const slot = slotsMap[num];
            const configured = Boolean(slot && slot.isConfigured && slot.word?.trim());
            const enabled = configured && slot.enabled !== false;
            const isEditing = editingSlotNum === num;

            return (
              <div
                key={num}
                className={`rounded-xl border p-2.5 transition flex flex-col justify-between gap-2 ${
                  isEditing
                    ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/40'
                    : enabled
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : configured
                    ? 'border-amber-300 bg-amber-50/60'
                    : 'border-dashed border-slate-300 bg-slate-50/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setEditingSlotNum(num)}
                  className="text-left w-full cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-black tabular-nums ${
                        enabled
                          ? 'text-emerald-900'
                          : configured
                          ? 'text-amber-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {num}번
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        enabled
                          ? 'bg-emerald-600 text-white'
                          : configured
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {enabled ? '출제' : configured ? '제외' : '미지정'}
                    </span>
                  </div>

                  {configured && slot ? (
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-slate-500 truncate">
                        {slot.level} · {slot.lessonName}
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {slot.word}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        → {slot.hanjaChar} {slot.hanjaMeaning}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 py-2">클릭하여 문제 지정</div>
                  )}
                </button>

                {configured && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[11px]">
                    <label className="flex items-center gap-1 cursor-pointer select-none font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => handleToggleSlotEnabled(num)}
                        className="rounded accent-emerald-600"
                      />
                      <span>출제 포함</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleClearSlot(num)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                      title="이 번호 초기화"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Selected Number Slot Configuration Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              2. 문제 {editingSlotNum}번 설정
            </h3>
            <p className="text-xs text-slate-500">
              급수 → 과 → 노래를 선택한 뒤, 아래 한자별 노래 가사에서 출제할 단어를 드래그해 저장하세요.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={(e) => setDraftEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <span>오늘 수업 출제 포함</span>
            </label>
            <button
              type="button"
              onClick={handleSaveSlot}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>문제 {editingSlotNum}번 저장</span>
            </button>
          </div>
        </div>

        {/* Step 1 & 2: Grade & Lesson Select */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">1) 급수 선택</span>
              {otherLevels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllLevels((v) => !v)}
                  className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  {showAllLevels ? '주요 급수(8~5급·준5급)만 보기' : '전체 급수 더보기'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(showAllLevels ? state.levels : [...PRIMARY_SONG_LEVELS]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDraftLevel(lvl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    draftLevel === lvl
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              2) {draftLevel} 과 선택
            </span>
            <div className="flex flex-wrap gap-1.5">
              {lessonsForDraftLevel.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2 w-full">
                  등록된 과가 없습니다. &quot;노래 및 가사 관리&quot; 탭에서 과를 추가해 주세요.
                </div>
              ) : (
                lessonsForDraftLevel.map((lName) => {
                  const lObj = state.songLessons?.[makeSongLessonId(draftLevel, lName)];
                  const lCount = getLessonSongHanjaLyrics(lObj).length;
                  return (
                    <button
                      key={lName}
                      type="button"
                      onClick={() => setDraftLessonName(lName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        draftLessonName === lName
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lName}
                      {lCount > 0 && (
                        <span className="ml-1 opacity-75">({lCount})</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Select Song from Lesson */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-700">
            3) {draftLevel} {draftLessonName} 노래 선택 ({availableSongs.length}곡 등록됨)
          </div>
          {availableSongs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
              이 과에 등록된 노래가 아직 없습니다. &quot;노래 및 가사 관리&quot; 탭에서 유튜브 링크나 음원 파일을 추가해 주세요.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSongs.map((song) => {
                const isSel = draftSongId === song.id;
                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => {
                      setDraftSongId(song.id);
                      setDraftStartTime(Number(song.startTime) || 0);
                      setDraftEndTime(song.endTime ?? null);
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                      isSel
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {song.type === 'youtube' ? (
                      <Youtube className={`w-4 h-4 ${isSel ? 'text-rose-400' : 'text-rose-600'}`} />
                    ) : (
                      <Music className={`w-4 h-4 ${isSel ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    )}
                    <span>{song.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 4: Per-Hanja Lyrics List with Drag/Long-press Selection */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  4) {draftLevel} {draftLessonName} 한자별 노래 가사에서 단어 드래그 선택
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  마우스로 가사 단어를 드래그하거나(예: &quot;엑스자&quot;), 모바일·태블릿에서는 길게 눌러 선택하거나 아래 터치 선택 버튼을 누르세요.
                </span>
              </p>
            </div>
            {availableHanjaLyrics.length > 0 && (
              <button
                type="button"
                onClick={handleAutoFillSlotsFromDraftLesson}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>이 과 가사로 1~{Math.min(10, availableHanjaLyrics.length)}번 자동 채우기</span>
              </button>
            )}
          </div>

          {/* Mobile / Tablet native selection confirm banner */}
          {pendingNativeSel && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-blue-900 font-semibold">
                선택한 단어: <strong className="font-black">&quot;{pendingNativeSel.text}&quot;</strong> → 정답 한자{' '}
                <strong>{pendingNativeSel.lyricItem.hanjaChar} ({pendingNativeSel.lyricItem.hanjaMeaning})</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  applySelectionToDraft(
                    pendingNativeSel.lyricItem,
                    pendingNativeSel.text,
                    pendingNativeSel.startOffset,
                    pendingNativeSel.endOffset
                  )
                }
                className="px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                이 단어로 지정하기
              </button>
            </div>
          )}

          {availableHanjaLyrics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
              이 과에 등록된 한자별 노래 가사가 없습니다. &quot;노래 및 가사 관리&quot; 탭에서 먼저 한자별 가사를 등록해 주세요.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {availableHanjaLyrics.map((item, idx) => {
                const isSelectedLyric = draftLyricItemId === item.id;
                const isTouchRowActive = touchTapRowId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition ${
                      isSelectedLyric ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 shrink-0 sm:w-44">
                      <span className="text-xs font-mono font-bold text-slate-400 tabular-nums w-6">
                        {idx + 1}.
                      </span>
                      <span className="text-xl font-black text-slate-900 w-8 text-center">
                        {item.hanjaChar || '—'}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {item.hanjaMeaning}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {!isTouchRowActive ? (
                        <div
                          ref={(el) => {
                            activeLyricRefMap.current[item.id] = el;
                          }}
                          onMouseUp={() => handleLyricMouseUp(item)}
                          className="text-base font-medium text-slate-900 leading-relaxed select-text cursor-text bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 selection:bg-amber-300 selection:text-slate-950"
                        >
                          {item.lyricLine || '(가사 없음)'}
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                          <div className="text-[11px] font-bold text-amber-900">
                            {touchAnchorIdx === null
                              ? '단어의 첫 글자를 터치하세요.'
                              : '단어의 마지막 글자를 터치하세요.'}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from(item.lyricLine).map((ch, cIdx) => {
                              const isAnchor = touchAnchorIdx === cIdx;
                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => handleTouchCharTap(item, cIdx)}
                                  className={`min-w-[26px] h-8 px-1 rounded text-sm font-bold border transition cursor-pointer ${
                                    isAnchor
                                      ? 'bg-blue-600 text-white border-blue-700'
                                      : 'bg-white text-slate-800 border-slate-300 hover:bg-blue-50'
                                  }`}
                                >
                                  {ch === ' ' ? '␣' : ch}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (isTouchRowActive) {
                            setTouchTapRowId(null);
                            setTouchAnchorIdx(null);
                          } else {
                            setTouchTapRowId(item.id);
                            setTouchAnchorIdx(null);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                          isTouchRowActive
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                        title="모바일/태블릿에서 두 글자를 눌러 단어 선택"
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>{isTouchRowActive ? '닫기' : '터치 선택'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 5: Selected Question Preview & Edit before Saving */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-slate-700">
            5) 문제 {editingSlotNum}번 저장 내용 확인
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                출제 단어 (학생 화면 표시)
              </label>
              <input
                type="text"
                value={draftWord}
                onChange={(e) => setDraftWord(e.target.value)}
                placeholder="가사에서 드래그하면 자동 입력"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                연결된 정답 한자
              </label>
              <input
                type="text"
                value={draftHanjaChar}
                onChange={(e) => setDraftHanjaChar(e.target.value)}
                placeholder="예: 五"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                음과 뜻
              </label>
              <input
                type="text"
                value={draftHanjaMeaning}
                onChange={(e) => setDraftHanjaMeaning(e.target.value)}
                placeholder="예: 다섯 오"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">재생 구간(초):</span>
              <input
                type="number"
                min={0}
                value={draftStartTime}
                onChange={(e) => setDraftStartTime(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-center font-mono tabular-nums"
              />
              <span>~</span>
              <input
                type="number"
                min={0}
                placeholder="끝까지"
                value={draftEndTime ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setDraftEndTime(v === '' ? null : Math.max(0, Number(v) || 0));
                }}
                className="w-24 px-2 py-1 rounded-lg border border-slate-300 bg-white text-center font-mono tabular-nums"
              />
            </div>

            <div className="flex items-center gap-2">
              {slotsMap[editingSlotNum]?.isConfigured && (
                <button
                  type="button"
                  onClick={() => handleClearSlot(editingSlotNum)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>번호 초기화</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveSlot}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>문제 {editingSlotNum}번 저장하기</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
