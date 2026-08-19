import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Save,
  FolderPlus,
  RotateCcw,
  Download,
  Upload,
  Check,
  AlertCircle,
  ListPlus,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { AppState, RangeProblemData, SectionRole } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { sortRangesByPage } from '../utils/sorter';

interface AdminScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  state,
  onUpdateState,
  isAdminAuthenticated,
  setIsAdminAuthenticated,
}) => {
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [newLevelName, setNewLevelName] = useState<string>('');

  // Selected level for Problem Bank registration
  const [activeBankLevel, setActiveBankLevel] = useState<string>(state.levels[0] || '8급');

  // Selected level for Quiz Pool management
  const [activeQuizPoolLevel, setActiveQuizPoolLevel] = useState<string>(state.levels[0] || '8급');
  const [quizPoolText, setQuizPoolText] = useState<string>(
    (state.quizPool?.[state.levels[0] || '8급'] || []).join(', ')
  );

  // Problem bank single text input per problem
  const [newRangeName, setNewRangeName] = useState<string>('');
  const [prob1Text, setProb1Text] = useState<string>('');
  const [prob2Text, setProb2Text] = useState<string>('');
  const [prob3Text, setProb3Text] = useState<string>('');
  const [prob4Text, setProb4Text] = useState<string>('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === state.adminPassword) {
      setIsAdminAuthenticated(true);
      setLoginError('');
      setPasswordInput('');
      showToast('관리자 인증에 성공하였습니다.');
    } else {
      setLoginError('비밀번호가 일치하지 않습니다. (초기 비밀번호: 1234)');
    }
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
  };

  // Add new level
  const handleAddLevel = () => {
    const trimmed = newLevelName.trim();
    if (!trimmed) {
      showToast('급수 이름을 입력해주세요.', 'error');
      return;
    }
    if (state.levels.includes(trimmed)) {
      showToast('이미 존재하는 급수입니다.', 'error');
      return;
    }

    onUpdateState((prev) => ({
      ...prev,
      levels: [...prev.levels, trimmed],
      lessonData: {
        ...prev.lessonData,
        [trimmed]: {
          planA: '새 진도 범위 A',
          planB: '새 진도 범위 B',
          planC: '새 진도 범위 C',
        },
      },
      bank: {
        ...prev.bank,
        [trimmed]: prev.bank[trimmed] || {},
      },
      quizPool: {
        ...prev.quizPool,
        [trimmed]: prev.quizPool[trimmed] || [],
      },
    }));

    setNewLevelName('');
    setActiveBankLevel(trimmed);
    setActiveQuizPoolLevel(trimmed);
    setQuizPoolText('');
    showToast(`새 급수 [${trimmed}]가 추가되었습니다.`);
  };

  const handleDeleteLevel = (levelToDelete: string) => {
    if (state.levels.length <= 1) {
      showToast('최소 1개 이상의 급수가 유지되어야 합니다.', 'error');
      return;
    }
    if (!window.confirm(`[${levelToDelete}] 급수를 삭제하시겠습니까?`)) {
      return;
    }

    onUpdateState((prev) => {
      const nextLevels = prev.levels.filter((l) => l !== levelToDelete);
      const nextLessonData = { ...prev.lessonData };
      delete nextLessonData[levelToDelete];
      const nextBank = { ...prev.bank };
      delete nextBank[levelToDelete];
      const nextQuizPool = { ...prev.quizPool };
      delete nextQuizPool[levelToDelete];
      const nextHidden = prev.hiddenLevels.filter((l) => l !== levelToDelete);

      return {
        ...prev,
        levels: nextLevels,
        lessonData: nextLessonData,
        bank: nextBank,
        quizPool: nextQuizPool,
        hiddenLevels: nextHidden,
      };
    });

    if (activeBankLevel === levelToDelete) {
      const fallback = state.levels.find((l) => l !== levelToDelete) || '';
      setActiveBankLevel(fallback);
      setActiveQuizPoolLevel(fallback);
      setQuizPoolText((state.quizPool[fallback] || []).join(', '));
    }
    showToast(`[${levelToDelete}] 급수가 삭제되었습니다.`);
  };

  // Update a single level's plan in Section A, B, or C
  const handleUpdateLevelPlan = (
    lvl: string,
    secKey: 'A' | 'B' | 'C',
    rangeValue: string
  ) => {
    const planProp = `plan${secKey}` as keyof typeof state.lessonData[string];
    onUpdateState((prev) => ({
      ...prev,
      lessonData: {
        ...prev.lessonData,
        [lvl]: {
          ...(prev.lessonData[lvl] || { planA: '', planB: '', planC: '' }),
          [planProp]: rangeValue,
        },
      },
    }));
  };

  // Sticker Cycle for Section A, B, C
  const cycleSectionRole = (section: 'A' | 'B' | 'C') => {
    const current = state.sectionRoles[section];
    const order: SectionRole[] = ['prev', 'today', 'next', 'custom'];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    const nextRole = order[nextIdx];

    onUpdateState((prev) => ({
      ...prev,
      sectionRoles: {
        ...prev.sectionRoles,
        [section]: nextRole,
      },
    }));
  };

  const getRoleBadge = (role: SectionRole) => {
    switch (role) {
      case 'prev':
        return { label: '저번 시간에 배운 한자', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'today':
        return { label: '오늘 배울 한자', color: 'bg-blue-600 text-white border-blue-700' };
      case 'next':
        return { label: '다음 시간에 배울 한자', color: 'bg-emerald-600 text-white border-emerald-700' };
      default:
        return { label: '기타/자유 진도', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
  };

  // Save new range to problem bank (Single text per problem)
  const handleSaveToProblemBank = () => {
    const trimmedRange = newRangeName.trim();
    if (!trimmedRange) {
      showToast('범위명을 입력해주세요 (예: 165페이지).', 'error');
      return;
    }

    if (!prob1Text.trim() && !prob2Text.trim() && !prob3Text.trim() && !prob4Text.trim()) {
      showToast('최소 1개 이상의 문제 내용을 입력해주세요.', 'error');
      return;
    }

    const rangeEntry: RangeProblemData = {
      rangeName: trimmedRange,
      prob1: prob1Text.trim(),
      prob2: prob2Text.trim(),
      prob3: prob3Text.trim(),
      prob4: prob4Text.trim(),
    };

    onUpdateState((prev) => {
      const currentLevelBank = prev.bank[activeBankLevel] || {};
      return {
        ...prev,
        bank: {
          ...prev.bank,
          [activeBankLevel]: {
            ...currentLevelBank,
            [trimmedRange]: rangeEntry,
          },
        },
      };
    });

    setNewRangeName('');
    setProb1Text('');
    setProb2Text('');
    setProb3Text('');
    setProb4Text('');
    showToast(`[${activeBankLevel}] 문제은행에 [${trimmedRange}] 범위가 페이지순으로 저장되었습니다.`);
  };

  const handleDeleteBankRange = (lvl: string, rng: string) => {
    if (!window.confirm(`[${lvl}]의 [${rng}] 문제 범위를 삭제하시겠습니까?`)) return;

    onUpdateState((prev) => {
      const nextBank = { ...prev.bank };
      if (nextBank[lvl]) {
        const nextLevelRanges = { ...nextBank[lvl] };
        delete nextLevelRanges[rng];
        nextBank[lvl] = nextLevelRanges;
      }
      return { ...prev, bank: nextBank };
    });
    showToast(`[${lvl} - ${rng}] 범위가 삭제되었습니다.`);
  };

  // Save Quiz Pool for a level
  const handleSaveQuizPool = () => {
    const items = quizPoolText
      .split(/[,;\n]/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);

    onUpdateState((prev) => ({
      ...prev,
      quizPool: {
        ...prev.quizPool,
        [activeQuizPoolLevel]: items,
      },
    }));

    showToast(`[${activeQuizPoolLevel}] 실시간 문제 출제용 한자 풀 (${items.length}개)이 저장되었습니다.`);
  };

  const handleResetToDefault = () => {
    if (window.confirm('모든 데이터를 초기 기본 교육과정으로 초기화하시겠습니까?')) {
      onUpdateState(() => ({ ...INITIAL_STATE }));
      setQuizPoolText((INITIAL_STATE.quizPool[activeQuizPoolLevel] || []).join(', '));
      showToast('기본 데이터로 초기화되었습니다.');
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hanja_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('백업 파일이 다운로드되었습니다.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.levels && parsed.bank) {
            onUpdateState(() => parsed);
            showToast('데이터를 성공적으로 불러왔습니다.');
          } else {
            showToast('올바르지 않은 백업 파일 형식입니다.', 'error');
          }
        } catch {
          showToast('JSON 파일을 파싱하는 중 오류가 발생했습니다.', 'error');
        }
      };
    }
  };

  // 1. Password Lock View
  if (!isAdminAuthenticated) {
    return (
      <div id="screen-admin" className="max-w-md mx-auto my-12">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">관리자 인증</h2>
            <p className="text-xs text-slate-500">
              섹션 A/B/C 진도 설정, 문제은행, 실시간 문제 출제 풀 관리를 위해 비밀번호를 입력하세요.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                id="admin-pw"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력 (기본: 1234)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                autoFocus
              />
              {loginError && (
                <p className="text-xs text-rose-600 font-semibold mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {loginError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xs transition active:scale-98 cursor-pointer"
            >
              로그인
            </button>
          </form>

          <p className="text-xs text-slate-400">
            초기 비밀번호는 <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">1234</code> 입니다.
          </p>
        </div>
      </div>
    );
  }

  // 2. Admin Content View - Sorted ranges by page number
  const rawBankRanges = state.bank[activeBankLevel] ? Object.keys(state.bank[activeBankLevel]) : [];
  const bankRangesForActiveLevel = sortRangesByPage(rawBankRanges);

  return (
    <div id="screen-admin" className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-bounce ${
            feedbackMsg.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
          }`}
        >
          {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Admin Top Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">관리자 제어판 (진도 범위, 문제은행 & 실시간 퀴즈 풀)</h2>
            <p className="text-xs text-slate-400">
              문제은행은 입력 순서와 상관없이 자동으로 <strong>페이지 번호순으로 정렬</strong>됩니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>백업 다운로드</span>
          </button>

          <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>백업 불러오기</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded-lg border border-rose-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>기본값 복원</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition ml-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* Global Level Management Pill Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700">전체 급수 ({state.levels.length}개):</span>
          {state.levels.map((lvl) => (
            <span
              key={lvl}
              className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 font-bold text-slate-800 flex items-center gap-1.5"
            >
              <span>{lvl}</span>
              {state.levels.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteLevel(lvl)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="급수 삭제"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>

        {/* Quick Add Level */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            placeholder="새 급수 추가 (예: 준2급)"
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 w-32 focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddLevel()}
          />
          <button
            type="button"
            onClick={handleAddLevel}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>추가</span>
          </button>
        </div>
      </div>

      {/* 1. 실시간 문제 출제용 한자 풀 관리 (NEW: Real-time Quiz Pool Manager) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-slate-900">
              실시간 문제 출제용 급수별 한자(뜻·음) 풀 관리
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            여기 입력된 한자들 중에서 퀴즈 화면에서 15개, 20개씩 무작위로 출제됩니다.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Level Tabs */}
          <div className="lg:col-span-3 flex flex-wrap lg:flex-col gap-1.5 overflow-x-auto">
            {state.levels.map((lvl) => {
              const count = state.quizPool?.[lvl]?.length || 0;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setActiveQuizPoolLevel(lvl);
                    setQuizPoolText((state.quizPool?.[lvl] || []).join(', '));
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                    activeQuizPoolLevel === lvl
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{lvl}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeQuizPoolLevel === lvl ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'}`}>
                    {count}개
                  </span>
                </button>
              );
            })}
          </div>

          {/* Textarea & Save */}
          <div className="lg:col-span-9 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>[{activeQuizPoolLevel}] 출제용 뜻·음 목록 (쉼표나 줄바꿈으로 구분)</span>
              <span className="text-blue-600 font-bold">
                현재 등록: {(quizPoolText.split(/[,;\n]/).filter((s) => s.trim().length > 0)).length}개
              </span>
            </div>

            <textarea
              rows={4}
              value={quizPoolText}
              onChange={(e) => setQuizPoolText(e.target.value)}
              placeholder="예: 날 일, 달 월, 불 화, 물 수, 나무 목, 쇠 금, 흙 토, 뫼 산, 내 천..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium leading-relaxed focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                ※ 쉼표(,)나 엔터(줄바꿈)로 단어들을 편하게 적어 넣으시면 됩니다.
              </span>
              <button
                type="button"
                onClick={handleSaveQuizPool}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>[{activeQuizPoolLevel}] 퀴즈 풀 저장</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sections A, B, C Range Settings & Problem Bank (Auto Sorted by Page Number) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): 3 Section Curriculums (A, B, C) */}
        <div className="lg:col-span-7 space-y-6">
          {(['A', 'B', 'C'] as const).map((secKey) => {
            const role = state.sectionRoles[secKey];
            const badge = getRoleBadge(role);
            const planKey = `plan${secKey}` as keyof typeof state.lessonData[string];

            return (
              <div
                key={secKey}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4"
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                      {secKey}
                    </span>
                    <h3 className="text-base font-bold text-slate-800">
                      섹션 {secKey} 진도 범위 설정
                    </h3>

                    {/* Sticker Button */}
                    <button
                      type="button"
                      onClick={() => cycleSectionRole(secKey)}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold transition cursor-pointer active:scale-95 ${badge.color}`}
                      title="클릭하여 역할 스티커 변경"
                    >
                      <span>🏷️ {badge.label}</span>
                      <span className="text-[10px] opacity-70 ml-0.5">(변경)</span>
                    </button>
                  </div>

                  <span className="text-xs text-slate-400">
                    직접 입력하거나 페이지순 문제은행에서 선택
                  </span>
                </div>

                {/* Level List for this Section */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {state.levels.map((lvl) => {
                    const currentVal = state.lessonData[lvl]?.[planKey] || '';
                    const levelBankRanges = sortRangesByPage(
                      state.bank[lvl] ? Object.keys(state.bank[lvl]) : []
                    );

                    return (
                      <div
                        key={`${secKey}-${lvl}`}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                      >
                        <div className="flex items-center gap-2 sm:w-24 shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold text-xs min-w-[50px] text-center shadow-2xs">
                            {lvl}
                          </span>
                        </div>

                        {/* Direct input & Page-Sorted Dropdown */}
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => handleUpdateLevelPlan(lvl, secKey, e.target.value)}
                            placeholder="범위 직접 입력 (예: 165p)..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                          />

                          {levelBankRanges.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleUpdateLevelPlan(lvl, secKey, e.target.value);
                                }
                              }}
                              value={levelBankRanges.includes(currentVal) ? currentVal : ''}
                              className="text-xs bg-white border border-blue-300 text-blue-800 font-bold rounded-lg px-2 py-1.5 max-w-[140px]"
                            >
                              <option value="" disabled>
                                페이지순 문제은행
                              </option>
                              {levelBankRanges.map((rng) => (
                                <option key={rng} value={rng}>
                                  {rng}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column (5 cols): Problem Bank Registration (Page-Sorted) & List */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Range to Bank */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  문제은행 새 범위 & 문제 등록
                </h3>
              </div>
              <span className="text-xs text-slate-400">자동 페이지순 정렬</span>
            </div>

            {/* Level Select for Bank */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                급수 선택
              </label>
              <select
                value={activeBankLevel}
                onChange={(e) => setActiveBankLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500"
              >
                {state.levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Range Name (Page order will automatically be parsed) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                범위명 (페이지/과 기입 시 자동 정렬)
              </label>
              <input
                type="text"
                value={newRangeName}
                onChange={(e) => setNewRangeName(e.target.value)}
                placeholder="예: 165페이지, 10p 기초 자연, 25쪽"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 4 Problems - Single free text inputs */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
                <span>문제 내용 (한 칸에 자유롭게 기입)</span>
                <span className="text-[11px] text-blue-600">※ 3개든 4개든 자유 입력</span>
              </div>

              {/* Problem 1 */}
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">문제 1번</label>
                <input
                  type="text"
                  value={prob1Text}
                  onChange={(e) => setProb1Text(e.target.value)}
                  placeholder="예: 날 일, 달 월, 불 화"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              {/* Problem 2 */}
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">문제 2번</label>
                <input
                  type="text"
                  value={prob2Text}
                  onChange={(e) => setProb2Text(e.target.value)}
                  placeholder="예: 물 수, 나무 목, 쇠 금"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              {/* Problem 3 */}
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">문제 3번</label>
                <input
                  type="text"
                  value={prob3Text}
                  onChange={(e) => setProb3Text(e.target.value)}
                  placeholder="예: 흙 토, 뫼 산, 내 천"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              {/* Problem 4 */}
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-0.5">문제 4번</label>
                <input
                  type="text"
                  value={prob4Text}
                  onChange={(e) => setProb4Text(e.target.value)}
                  placeholder="예: 하늘 천, 땅 지, 사람 인"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveToProblemBank}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 mt-2"
              >
                <Save className="w-4 h-4" />
                <span>[{activeBankLevel}] 문제은행에 저장하기</span>
              </button>
            </div>
          </div>

          {/* Registered Ranges in Bank (Auto Sorted by Page Number) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  [{activeBankLevel}] 등록된 문제 (페이지순 정렬)
                </h4>
              </div>
              <span className="text-xs text-slate-400">{bankRangesForActiveLevel.length}개</span>
            </div>

            {bankRangesForActiveLevel.length > 0 ? (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {bankRangesForActiveLevel.map((rng) => {
                  const entry = state.bank[activeBankLevel]?.[rng];
                  return (
                    <div
                      key={rng}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm">📍 {rng}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankRange(activeBankLevel, rng)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Problem text lines */}
                      {entry && (
                        <div className="space-y-1 text-slate-700 text-[11px] bg-white p-2 rounded-lg border border-slate-200">
                          {entry.prob1 && <div><span className="font-bold text-blue-700">문제1:</span> {entry.prob1}</div>}
                          {entry.prob2 && <div><span className="font-bold text-blue-700">문제2:</span> {entry.prob2}</div>}
                          {entry.prob3 && <div><span className="font-bold text-blue-700">문제3:</span> {entry.prob3}</div>}
                          {entry.prob4 && <div><span className="font-bold text-blue-700">문제4:</span> {entry.prob4}</div>}
                        </div>
                      )}

                      {/* Quick assignment to Section A, B, or C */}
                      <div className="pt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 mr-0.5">할당:</span>
                        {(['A', 'B', 'C'] as const).map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              handleUpdateLevelPlan(activeBankLevel, sec, rng);
                              showToast(`[${rng}]이 [${activeBankLevel} - 섹션 ${sec}]에 적용되었습니다.`);
                            }}
                            className="flex-1 text-[11px] font-bold px-2 py-1 rounded bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 cursor-pointer"
                          >
                            섹션 {sec}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                등록된 문제은행이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
