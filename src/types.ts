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

  // Backward compatibility fields
  lessonData: Record<string, LevelLessonPlan>;
  sectionRoles: Record<string, SectionRole>;
}

export type ActiveTab = 'lesson' | 'quiz' | 'admin';
