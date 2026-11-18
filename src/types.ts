export interface RangeProblemData {
  rangeName: string;
  prob1: string; // Free text
  prob2: string;
  prob3: string;
  prob4: string;
}

export type SectionRole = 'prev' | 'today' | 'next' | 'review' | 'homework' | 'custom';

// A dynamic row/item inside a section
export interface SectionRowItem {
  id: string; // unique id e.g. 'row_123'
  levelLabel: string; // e.g. '준5급 0', '준5급 1', '준6급', '8급 A반'
  baseLevel?: string; // e.g. '준4급', '준5급' (linked problem bank base level)
  rangeName: string; // e.g. '8과 생활과 예절 (140p)', '150쪽'
  customProb1?: string; // Optional custom problem override
  customProb2?: string;
  customProb3?: string;
  customProb4?: string;
}

export interface SectionItem {
  id: string; // e.g. 'A', 'B', 'C', 'D'
  name: string; // e.g. '섹션 A', '섹션 B', '섹션 C'
  role: SectionRole | string;
  items: SectionRowItem[]; // DYNAMIC INDEPENDENT LIST OF LEVEL ROWS PER SECTION!
  selectedLevels?: string[]; // Legacy fallback
}

export interface LevelLessonPlan {
  planA: string;
  planB: string;
  planC: string;
  [secKey: string]: string;
}

export interface SongQuestionItem {
  id: string;
  word: string; // Dragged word from lyrics e.g. '엑스자'
  startOffset: number; // Start index in lyrics
  endOffset: number; // End index in lyrics
  hanjaChar: string; // Answer Hanja e.g. '五'
  hanjaMeaning: string; // Reading/meaning e.g. '다섯 오'
}

export interface SongAudioFileMeta {
  audioId: string; // Unique ID stored on server data/song_audio/<audioId>.bin
  fileName: string; // Original file name e.g. '8급_1과.mp3'
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SongMediaItem {
  id: string;
  type: 'youtube' | 'audio';
  title: string; // 영상 제목 또는 음원 제목
  youtubeUrl?: string;
  audioFile?: SongAudioFileMeta | null;
  startTime: number; // seconds
  endTime: number | null; // seconds or null
  createdAt: string;
}

export interface SongHanjaLyricItem {
  id: string;
  hanjaChar: string; // 예: '一'
  hanjaMeaning: string; // 예: '한 일'
  lyricLine: string; // 예: '나무 막대 한 개는 한일'
  order: number;
}

export interface SongLessonData {
  id: string; // `${level}__${lessonName}`
  level: string;
  lessonName: string;
  // Multi-song & per-Hanja lyric structures
  songs?: SongMediaItem[];
  hanjaLyrics?: SongHanjaLyricItem[];
  // Legacy / single-song compatibility fields
  youtubeUrl: string;
  startTime: number; // seconds
  endTime: number | null; // seconds or null for full
  activeMediaSource: 'youtube' | 'audio';
  audioFile?: SongAudioFileMeta | null;
  lyrics: string;
  questions: SongQuestionItem[];
  updatedAt: string;
}

export interface SongNumberSlot {
  slotNumber: number; // 1 ~ 10
  isConfigured: boolean;
  enabled: boolean; // 오늘 수업에 포함 여부
  level: string;
  lessonName: string;
  songId: string;
  songTitle?: string;
  lyricItemId: string;
  fullLyric: string;
  word: string; // 드래그한 출제 단어 (예: '엑스자')
  startOffset: number;
  endOffset: number;
  hanjaChar: string; // 정답 한자 (예: '五')
  hanjaMeaning: string; // 음과 뜻 (예: '다섯 오')
  startTime: number;
  endTime: number | null;
  wordFontSize: number; // 문제 가사(단어) 글자 크기 px
  hanjaFontSize: number; // 한자 글자 크기 px
  meaningFontSize: number; // 음과 뜻 글자 크기 px
  updatedAt: string;
}

export interface SongQuizSetItem {
  id: string; // unique set item id
  sourceQuestionId: string;
  sourceLessonId: string;
  level: string;
  lessonName: string;
  word: string;
  hanjaChar: string;
  hanjaMeaning: string;
}

export interface SongQuizSet {
  id: string;
  title: string; // e.g. '11월 18일 수업'
  selectedLevels: string[];
  selectedLessonIds: string[];
  lessonQuotas: Record<string, number>;
  selectedQuestionIds: string[];
  targetCount: number;
  orderMode: 'byLesson' | 'custom' | 'shuffleAll' | 'shufflePerLesson';
  items: SongQuizSetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  fontSize: number;
  levels: string[]; // Global standard levels (8급 ~ 특급)
  hiddenLevels: string[];
  sections: SectionItem[]; // Dynamic sections, each containing dynamic custom rows (e.g. 준5급 0, 준5급 1)
  sectionPlans: Record<string, Record<string, string>>; // Legacy mapping
  sectionSelectedLevels?: Record<string, string[]>; // Legacy mapping
  bank: Record<string, Record<string, RangeProblemData>>; // level -> rangeName -> RangeProblemData
  bankRangeOrder?: Record<string, string[]>; // level -> custom ordered array of range names
  quizPool: Record<string, string[]>; // level -> array of Hanja meaning strings
  adminPassword: string;
  soundEnabled: boolean;
  lastAutoBackupTime?: string;

  // Song Quiz feature data (backward-compatible optional fields)
  songCustomLessons?: Record<string, string[]>; // level -> ordered lesson names for song quiz
  songLessons?: Record<string, SongLessonData>;
  songNumberSlots?: Record<number, SongNumberSlot>; // 1..10 numbered question slots
  songQuizSets?: SongQuizSet[];

  // Backward compatibility fields
  lessonData: Record<string, LevelLessonPlan>;
  sectionRoles: Record<string, SectionRole>;
}

export type ActiveTab = 'lesson' | 'quiz' | 'song' | 'admin';
