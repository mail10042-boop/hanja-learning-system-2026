export interface RangeProblemData {
  rangeName: string;
  prob1: string; // Free text (e.g. "날 일, 달 월, 불 화" or "1. 날 일 2. 달 월 3. 불 화 4. 물 수")
  prob2: string;
  prob3: string;
  prob4: string;
}

export type SectionRole = 'prev' | 'today' | 'next' | 'custom';

export interface LevelLessonPlan {
  planA: string; // Range name for Section A
  planB: string; // Range name for Section B
  planC: string; // Range name for Section C
}

export interface AppState {
  fontSize: number;
  levels: string[]; // e.g. ['8급', '7급', '준6급', '6급', '준5급', '5급', '준4급', '4급', '준3급', '3급', '2급']
  hiddenLevels: string[];
  bank: Record<string, Record<string, RangeProblemData>>; // level -> rangeName -> RangeProblemData
  lessonData: Record<string, LevelLessonPlan>; // level -> { planA, planB, planC }
  quizPool: Record<string, string[]>; // level -> array of Hanja meaning strings for real-time quiz
  sectionRoles: {
    A: SectionRole;
    B: SectionRole;
    C: SectionRole;
  };
  adminPassword: string;
  soundEnabled: boolean;
}

export type ActiveTab = 'lesson' | 'quiz' | 'admin';
