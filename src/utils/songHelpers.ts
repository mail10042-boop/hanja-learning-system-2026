import {
  AppState,
  SongHanjaLyricItem,
  SongLessonData,
  SongMediaItem,
  SongNumberSlot,
} from '../types';
import { getLessonHanjaCandidates, getLessonsForLevel } from './hanjaDictionary';

export const PRIMARY_SONG_LEVELS = ['8급', '7급', '6급', '준5급', '5급'] as const;

export const DEFAULT_WORD_FONT_SIZE = 88;
export const DEFAULT_HANJA_FONT_SIZE = 44;
export const DEFAULT_MEANING_FONT_SIZE = 20;

export const MIN_WORD_FONT_SIZE = 24;
export const MAX_WORD_FONT_SIZE = 240;
export const MIN_HANJA_FONT_SIZE = 18;
export const MAX_HANJA_FONT_SIZE = 240;
export const MIN_MEANING_FONT_SIZE = 12;
export const MAX_MEANING_FONT_SIZE = 120;

export function clampFontSize(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function makeSongLessonId(level: string, lessonName: string): string {
  return `${level}__${lessonName}`;
}

/**
 * Returns the managed lesson list for a given level in the Song Quiz system.
 * Uses state.songCustomLessons[level] if initialized; otherwise seeds from existing
 * problem bank / sections / saved songLessons, falling back to ['1과'].
 */
export function getManagedLessonsForLevel(state: AppState, level: string): string[] {
  const customList = state.songCustomLessons?.[level];
  if (Array.isArray(customList)) {
    const unique = new Set<string>(customList.filter((s) => typeof s === 'string' && s.trim()));
    // Also ensure any already-saved songLesson for this level stays reachable
    if (state.songLessons) {
      (Object.values(state.songLessons) as SongLessonData[]).forEach((sl) => {
        if (sl.level === level && sl.lessonName?.trim()) {
          unique.add(sl.lessonName.trim());
        }
      });
    }
    return Array.from(unique);
  }

  const fromSystem = getLessonsForLevel(state, level);
  return fromSystem.length > 0 ? fromSystem : ['1과'];
}

/**
 * Returns normalized list of songs (YouTube & Uploaded Audio) for a SongLessonData,
 * preserving backward compatibility with legacy single-song fields.
 */
export function getSongMediaList(lesson?: SongLessonData | null): SongMediaItem[] {
  if (!lesson) return [];
  if (Array.isArray(lesson.songs)) {
    return lesson.songs;
  }

  const migrated: SongMediaItem[] = [];
  if (lesson.youtubeUrl && lesson.youtubeUrl.trim()) {
    migrated.push({
      id: `${lesson.id}_yt_legacy`,
      type: 'youtube',
      title: `${lesson.level} ${lesson.lessonName} 유튜브 노래`,
      youtubeUrl: lesson.youtubeUrl.trim(),
      audioFile: null,
      startTime: Number(lesson.startTime) || 0,
      endTime: lesson.endTime ?? null,
      createdAt: lesson.updatedAt || new Date().toISOString(),
    });
  }
  if (lesson.audioFile?.audioId) {
    migrated.push({
      id: `${lesson.id}_aud_legacy`,
      type: 'audio',
      title: lesson.audioFile.fileName || `${lesson.level} ${lesson.lessonName} 음원`,
      youtubeUrl: '',
      audioFile: lesson.audioFile,
      startTime: Number(lesson.startTime) || 0,
      endTime: lesson.endTime ?? null,
      createdAt: lesson.updatedAt || new Date().toISOString(),
    });
  }
  return migrated;
}

/**
 * Returns normalized per-Hanja lyrics list for a SongLessonData,
 * migrating legacy questions/lyrics if hanjaLyrics is not yet populated.
 */
export function getLessonSongHanjaLyrics(lesson?: SongLessonData | null): SongHanjaLyricItem[] {
  if (!lesson) return [];
  if (Array.isArray(lesson.hanjaLyrics)) {
    return lesson.hanjaLyrics;
  }

  const migrated: SongHanjaLyricItem[] = [];
  if (Array.isArray(lesson.questions) && lesson.questions.length > 0) {
    lesson.questions.forEach((q, idx) => {
      migrated.push({
        id: q.id || `hl_mig_${idx}`,
        hanjaChar: q.hanjaChar || '',
        hanjaMeaning: q.hanjaMeaning || '',
        lyricLine: lesson.lyrics || q.word || '',
        order: idx + 1,
      });
    });
  }
  return migrated;
}

export function createEmptySongLesson(level: string, lessonName: string): SongLessonData {
  return {
    id: makeSongLessonId(level, lessonName),
    level,
    lessonName,
    songs: [],
    hanjaLyrics: [],
    youtubeUrl: '',
    startTime: 0,
    endTime: null,
    activeMediaSource: 'audio',
    audioFile: null,
    lyrics: '',
    questions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyNumberSlot(slotNumber: number): SongNumberSlot {
  return {
    slotNumber,
    isConfigured: false,
    enabled: true,
    level: '8급',
    lessonName: '1과',
    songId: '',
    songTitle: '',
    lyricItemId: '',
    fullLyric: '',
    word: '',
    startOffset: 0,
    endOffset: 0,
    hanjaChar: '',
    hanjaMeaning: '',
    startTime: 0,
    endTime: null,
    wordFontSize: DEFAULT_WORD_FONT_SIZE,
    hanjaFontSize: DEFAULT_HANJA_FONT_SIZE,
    meaningFontSize: DEFAULT_MEANING_FONT_SIZE,
    updatedAt: new Date().toISOString(),
  };
}

export interface ReferenceHanjaEntry {
  hanjaChar: string;
  hanjaMeaning: string;
}

/**
 * Collects unique Hanja + meaning reference list for the student whiteboard screen
 * WITHOUT highlighting or revealing which one is the answer.
 * Prioritizes Hanja registered in the lesson's hanjaLyrics, then appends existing lesson/pool candidates.
 */
export function getReferenceHanjaListForLesson(
  state: AppState,
  level: string,
  lessonName: string
): ReferenceHanjaEntry[] {
  const result: ReferenceHanjaEntry[] = [];
  const seen = new Set<string>();

  const pushEntry = (char: string, meaning: string) => {
    const cleanChar = (char || '').trim();
    const cleanMeaning = (meaning || '').trim();
    if (!cleanChar && !cleanMeaning) return;
    const key = cleanChar || cleanMeaning;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ hanjaChar: cleanChar, hanjaMeaning: cleanMeaning });
  };

  const lesson = state.songLessons?.[makeSongLessonId(level, lessonName)];
  const lyrics = getLessonSongHanjaLyrics(lesson);
  lyrics.forEach((item) => {
    pushEntry(item.hanjaChar, item.hanjaMeaning);
  });

  // Also include existing system Hanja registered for this specific lesson in bank (if any)
  const bankLesson = state.bank?.[level]?.[lessonName];
  if (bankLesson) {
    const candidates = getLessonHanjaCandidates(state, level, lessonName).filter(
      (c) => c.source === 'lesson'
    );
    candidates.forEach((c) => pushEntry(c.char, c.meaning));
  }

  return result;
}
