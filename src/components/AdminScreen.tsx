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
  Layers,
  Edit2,
  FileText,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';
import { AppState, RangeProblemData, SectionItem, SectionRowItem } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { sortRangesByPage } from '../utils/sorter';
import { extractBaseLevel, sortHanjaLevels } from '../utils/levelOrder';

interface AdminScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
}

const COMMON_PRESET_LABELS = [
  '8급',
  '7급',
  '준6급',
  '6급',
  '준5급 0',
  '준5급 1',
  '준5급',
  '5급',
  '준4급 0',
  '준4급 1',
  '준4급',
  '4급',
  '준3급',
  '3급',
  '2급',
  '1급',
];

export const AdminScreen: React.FC<AdminScreenProps> = ({
  state,
  onUpdateState,
  isAdminAuthenticated,
  setIsAdminAuthenticated,
}) => {
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [newSectionCustomName, setNewSectionCustomName] = useState<string>('');

  // Active dynamic sections list with safe fallback
  const activeSections: SectionItem[] = state.sections && state.sections.length > 0
    ? state.sections
    : INITIAL_STATE.sections;

  // Selected level for Problem Bank registration
  const [activeBankLevel, setActiveBankLevel] = useState<string>(state.levels[0] || '8급');

  // Problem bank single text input per problem
  const [newRangeName, setNewRangeName] = useState<string>('');
  const [prob1Text, setProb1Text] = useState<string>('');
  const [prob2Text, setProb2Text] = useState<string>('');
  const [prob3Text, setProb3Text] = useState<string>('');
  const [prob4Text, setProb4Text] = useState<string>('');

  // Section rename state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string>('');

  // Adding new row input per section
  const [newRowInputs, setNewRowInputs] = useState<Record<string, string>>({});

  // Expanded row details for custom questions override
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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

  // --- DYNAMIC SECTION MANAGEMENT ---
  const handleAddSection = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nextLetter = alphabet[activeSections.length] || `${activeSections.length + 1}`;
    const newName = newSectionCustomName.trim() || `섹션 ${nextLetter}`;
    const newId = `sec_${Date.now()}`;

    const newSectionItem: SectionItem = {
      id: newId,
      name: newName,
      role: 'custom',
      items: [
        { id: `row_${Date.now()}_1`, levelLabel: '8급', baseLevel: '8급', rangeName: '1과 (10p)' },
        { id: `row_${Date.now()}_2`, levelLabel: '준4급 0', baseLevel: '준4급', rangeName: '10과 (265p)' },
      ],
    };

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: [...currentSections, newSectionItem],
      };
    });

    setNewSectionCustomName('');
    showToast(`새 [${newName}]이(가) 추가되었습니다!`);
  };

  const handleDeleteSection = (secId: string, secName: string) => {
    if (activeSections.length <= 1) {
      showToast('최소 1개 이상의 섹션이 필요합니다.', 'error');
      return;
    }
    if (!window.confirm(`[${secName}]을(를) 삭제하시겠습니까?`)) {
      return;
    }

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.filter((s) => s.id !== secId),
      };
    });

    showToast(`[${secName}]이(가) 삭제되었습니다.`);
  };

  const handleSaveRenameSection = (secId: string) => {
    const trimmed = editingSectionName.trim();
    if (!trimmed) {
      setEditingSectionId(null);
      return;
    }
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => (s.id === secId ? { ...s, name: trimmed } : s)),
      };
    });
    setEditingSectionId(null);
    showToast(`섹션 이름이 [${trimmed}](으)로 변경되었습니다.`);
  };

  const cycleSectionRole = (secId: string) => {
    const ROLES: { role: string; label: string }[] = [
      { role: 'prev', label: '저번 시간에 배운 한자' },
      { role: 'today', label: '오늘 배울 한자' },
      { role: 'next', label: '다음 시간에 배울 한자' },
      { role: 'review', label: '복습·심화 진도' },
      { role: 'homework', label: '과제·자율 진도' },
      { role: 'custom', label: '기타/자유 진도' },
    ];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            const currentIdx = ROLES.findIndex((r) => r.role === s.role);
            const nextIdx = (currentIdx + 1) % ROLES.length;
            return { ...s, role: ROLES[nextIdx].role };
          }
          return s;
        }),
      };
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'prev':
        return { label: '저번 시간에 배운 한자', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'today':
        return { label: '오늘 배울 한자', color: 'bg-blue-600 text-white border-blue-700' };
      case 'next':
        return { label: '다음 시간에 배울 한자', color: 'bg-emerald-600 text-white border-emerald-700' };
      case 'review':
        return { label: '복습·심화 진도', color: 'bg-indigo-600 text-white border-indigo-700' };
      case 'homework':
        return { label: '과제·자율 진도', color: 'bg-purple-600 text-white border-purple-700' };
      default:
        return { label: '기타/자유 진도', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
  };

  // --- DYNAMIC SECTION ROW MANAGEMENT ---
  const handleAddRowToSection = (secId: string, customLabel?: string) => {
    const rawInput = (customLabel || newRowInputs[secId] || '').trim();
    if (!rawInput) {
      showToast('추가할 급수/항목 이름을 입력하거나 프리셋을 눌러주세요 (예: 준4급 0).', 'error');
      return;
    }

    const baseLvl = extractBaseLevel(rawInput);
    const newRow: SectionRowItem = {
      id: `row_${secId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      levelLabel: rawInput,
      baseLevel: baseLvl,
      rangeName: `${rawInput} 진도 범위`,
    };

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: [...(s.items || []), newRow],
            };
          }
          return s;
        }),
      };
    });

    setNewRowInputs((prev) => ({ ...prev, [secId]: '' }));
    showToast(`[${rawInput}] 항목이 추가되었습니다! 문제와 범위를 설정하세요.`);
  };

  // Move Row UP or DOWN
  const handleMoveRow = (secId: string, rowIdx: number, direction: 'up' | 'down') => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            const items = [...(s.items || [])];
            const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1;
            if (targetIdx < 0 || targetIdx >= items.length) return s;
            const temp = items[rowIdx];
            items[rowIdx] = items[targetIdx];
            items[targetIdx] = temp;
            return { ...s, items };
          }
          return s;
        }),
      };
    });
  };

  const handleDeleteRowFromSection = (secId: string, rowId: string, label: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).filter((r) => r.id !== rowId),
            };
          }
          return s;
        }),
      };
    });
    showToast(`[${label}] 항목이 삭제되었습니다.`);
  };

  const handleUpdateRowLabel = (secId: string, rowId: string, newLabel: string) => {
    const derivedBase = extractBaseLevel(newLabel);
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).map((r) => (r.id === rowId ? { ...r, levelLabel: newLabel, baseLevel: r.baseLevel || derivedBase } : r)),
            };
          }
          return s;
        }),
      };
    });
  };

  const handleUpdateRowBaseLevel = (secId: string, rowId: string, newBaseLevel: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).map((r) => (r.id === rowId ? { ...r, baseLevel: newBaseLevel } : r)),
            };
          }
          return s;
        }),
      };
    });
    showToast(`문제은행 기준 급수가 [${newBaseLevel}](으)로 설정되었습니다.`);
  };

  const handleUpdateRowRange = (secId: string, rowId: string, newRange: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).map((r) => (r.id === rowId ? { ...r, rangeName: newRange } : r)),
            };
          }
          return s;
        }),
      };
    });
  };

  // Select Bank Range for Row and load its 4 problems
  const handleSelectBankRangeForRow = (secId: string, rowId: string, selectedBankRange: string, baseLvl: string) => {
    const bankData = state.bank[baseLvl]?.[selectedBankRange];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).map((r) => {
                if (r.id === rowId) {
                  return {
                    ...r,
                    rangeName: selectedBankRange,
                    baseLevel: baseLvl,
                    customProb1: bankData?.prob1 ?? r.customProb1,
                    customProb2: bankData?.prob2 ?? r.customProb2,
                    customProb3: bankData?.prob3 ?? r.customProb3,
                    customProb4: bankData?.prob4 ?? r.customProb4,
                  };
                }
                return r;
              }),
            };
          }
          return s;
        }),
      };
    });

    showToast(`[${baseLvl}] 문제은행의 [${selectedBankRange}] 범위와 문제가 적용되었습니다!`);
  };

  const handleUpdateRowCustomProblem = (
    secId: string,
    rowId: string,
    probKey: 'customProb1' | 'customProb2' | 'customProb3' | 'customProb4',
    val: string
  ) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      return {
        ...prev,
        sections: currentSections.map((s) => {
          if (s.id === secId) {
            return {
              ...s,
              items: (s.items || []).map((r) => (r.id === rowId ? { ...r, [probKey]: val } : r)),
            };
          }
          return s;
        }),
      };
    });
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

  const handleResetToDefault = () => {
    if (window.confirm('모든 데이터를 초기 기본 교육과정으로 초기화하시겠습니까?')) {
      onUpdateState(() => ({ ...INITIAL_STATE, levels: sortHanjaLevels(INITIAL_STATE.levels) }));
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
          if (parsed.bank) {
            onUpdateState(() => ({ ...parsed, levels: sortHanjaLevels(parsed.levels || INITIAL_STATE.levels) }));
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
              섹션별 자유 급수(준4급 0, 준4급 1 등) 추가, 순서 이동, 문제은행 선택을 위해 비밀번호를 입력하세요.
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
            <h2 className="text-lg font-bold">관리자 제어판 (섹션별 순서 이동 & 자유 급수/문제 선택)</h2>
            <p className="text-xs text-slate-400">
              <strong>준4급 0, 준4급 1</strong> 등 같은 급수라도 원하는 순서대로 <strong>위/아래 이동(⬆⬇)</strong>하고, <strong>준4급 문제은행에서 문제를 직접 선택</strong>하여 구성할 수 있습니다.
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

      {/* 1. DYNAMIC SECTIONS: 섹션별 자유 급수 항목 (준4급 0, 준4급 1 등) 추가, 순서 이동(⬆⬇), 문제은행 선택 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Dynamic Section Curriculums */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800 text-sm">진도 섹션 목록 ({activeSections.length}개)</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSectionCustomName}
                onChange={(e) => setNewSectionCustomName(e.target.value)}
                placeholder="새 섹션 이름..."
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 w-32 focus:ring-2 focus:ring-blue-500 font-semibold"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
              />
              <button
                type="button"
                onClick={handleAddSection}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>섹션 추가</span>
              </button>
            </div>
          </div>

          {activeSections.map((sec, secIdx) => {
            const role = sec.role;
            const badge = getRoleBadge(role);
            const isEditing = editingSectionId === sec.id;
            const items = sec.items || [];

            return (
              <div
                key={sec.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4"
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                      {secIdx + 1}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingSectionName}
                          onChange={(e) => setEditingSectionName(e.target.value)}
                          className="px-2 py-1 text-sm font-bold rounded-lg border border-blue-400 w-28"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameSection(sec.id)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRenameSection(sec.id)}
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <h3 className="text-base font-bold text-slate-800">
                          {sec.name} 진도 목록
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectionId(sec.id);
                            setEditingSectionName(sec.name);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                          title="이름 수정"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Sticker Button */}
                    <button
                      type="button"
                      onClick={() => cycleSectionRole(sec.id)}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold transition cursor-pointer active:scale-95 ${badge.color}`}
                      title="클릭하여 역할 스티커 변경"
                    >
                      <span>🏷️ {badge.label}</span>
                      <span className="text-[10px] opacity-70 ml-0.5">(변경)</span>
                    </button>
                  </div>

                  {activeSections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec.id, sec.name)}
                      className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      섹션 삭제
                    </button>
                  )}
                </div>

                {/* ADD CUSTOM LEVEL ROW BOX (준4급 0, 준4급 1, 준5급 0 등 자유 입력) */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>➕ [{sec.name}]에 원하는 급수/진도 항목 추가:</span>
                    <span className="text-[11px] text-blue-600 font-semibold">
                      (현재 {items.length}개 항목)
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1">
                    {COMMON_PRESET_LABELS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAddRowToSection(sec.id, preset)}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition cursor-pointer active:scale-95"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>

                  {/* Direct Input for arbitrary custom names */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <input
                      type="text"
                      value={newRowInputs[sec.id] || ''}
                      onChange={(e) => setNewRowInputs({ ...newRowInputs, [sec.id]: e.target.value })}
                      placeholder="직접 급수명 입력 (예: 준4급 0, 준4급 1, 준5급 심화반)..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRowToSection(sec.id)}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddRowToSection(sec.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>항목 추가</span>
                    </button>
                  </div>
                </div>

                {/* DYNAMIC ROWS LIST FOR THIS SECTION (With Up/Down Sorting Buttons & Problem Selector) */}
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {items.length > 0 ? (
                    items.map((row, rowIdx) => {
                      const baseLvl = row.baseLevel || extractBaseLevel(row.levelLabel);
                      const baseBankRanges = sortRangesByPage(
                        state.bank[baseLvl] ? Object.keys(state.bank[baseLvl]) : []
                      );
                      const isExpanded = expandedRowId === row.id;

                      return (
                        <div
                          key={row.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                            {/* Reorder Buttons (Up / Down) + Editable Label Tag */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* UP / DOWN REORDER BUTTONS */}
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveRow(sec.id, rowIdx, 'up')}
                                  disabled={rowIdx === 0}
                                  className={`p-1 rounded border text-[10px] transition cursor-pointer ${
                                    rowIdx === 0
                                      ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                      : 'bg-white text-slate-700 hover:bg-blue-100 hover:text-blue-700 border-slate-300 shadow-2xs active:scale-90'
                                  }`}
                                  title="위로 올리기 (순서 변경)"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveRow(sec.id, rowIdx, 'down')}
                                  disabled={rowIdx === items.length - 1}
                                  className={`p-1 rounded border text-[10px] transition cursor-pointer ${
                                    rowIdx === items.length - 1
                                      ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                      : 'bg-white text-slate-700 hover:bg-blue-100 hover:text-blue-700 border-slate-300 shadow-2xs active:scale-90'
                                  }`}
                                  title="아래로 내리기 (순서 변경)"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Editable Label Tag */}
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="text"
                                  value={row.levelLabel}
                                  onChange={(e) => handleUpdateRowLabel(sec.id, row.id, e.target.value)}
                                  className="w-24 px-2 py-1.5 rounded-lg bg-slate-800 text-white font-black text-xs text-center border border-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-400"
                                  title="급수/항목 이름 직접 수정 가능 (예: 준4급 0)"
                                />
                                <span className="text-[9px] text-center text-slate-400 font-bold">
                                  순서 {rowIdx + 1}
                                </span>
                              </div>
                            </div>

                            {/* Range Direct Input & Problem Bank Dropdown */}
                            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                              {/* Range Text Input */}
                              <input
                                type="text"
                                value={row.rangeName}
                                onChange={(e) => handleUpdateRowRange(sec.id, row.id, e.target.value)}
                                placeholder="공부 범위 직접 입력 (예: 140p, 10과)..."
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                              />

                              {/* Direct Problem Bank Picker Dropdown with Base Level Indicator */}
                              <div className="flex items-center gap-1 shrink-0">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSelectBankRangeForRow(sec.id, row.id, e.target.value, baseLvl);
                                    }
                                  }}
                                  value={baseBankRanges.includes(row.rangeName) ? row.rangeName : ''}
                                  className="text-xs bg-blue-50 border border-blue-300 text-blue-900 font-bold rounded-lg px-2 py-1.5 max-w-[155px] cursor-pointer hover:bg-blue-100 transition"
                                  title={`[${baseLvl}] 문제은행에서 범위 및 문제 자동 선택`}
                                >
                                  <option value="">
                                    📚 [{baseLvl}] 문제 선택 ({baseBankRanges.length}개)
                                  </option>
                                  {baseBankRanges.map((rng) => (
                                    <option key={rng} value={rng}>
                                      {rng}
                                    </option>
                                  ))}
                                </select>

                                {/* Toggle Custom Problem & Bank Link Modal/Details */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    isExpanded
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                  }`}
                                  title="문제 1~4번 상세 보기 및 문제은행 선택"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>문제 설정</span>
                                </button>

                                {/* Delete Row Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRowFromSection(sec.id, row.id, row.levelLabel)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition text-xs"
                                  title="이 항목 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* EXPANDABLE INDIVIDUAL PROBLEM OVERRIDE & BANK SELECTOR AREA */}
                          {isExpanded && (
                            <div className="bg-white p-3.5 rounded-xl border-2 border-blue-200 space-y-3 mt-2 shadow-xs animate-in fade-in duration-150">
                              {/* Header & Bank Picker Helper */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs">
                                    {row.levelLabel}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">
                                    문제 1~4번 출제 설정
                                  </span>
                                </div>

                                {/* Base Level Selector for this row */}
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-slate-500 font-semibold">문제은행 기준 급수:</span>
                                  <select
                                    value={baseLvl}
                                    onChange={(e) => handleUpdateRowBaseLevel(sec.id, row.id, e.target.value)}
                                    className="px-2 py-1 rounded-md border border-slate-300 font-bold bg-slate-50 text-blue-700 cursor-pointer"
                                  >
                                    {state.levels.map((lvl) => (
                                      <option key={lvl} value={lvl}>
                                        {lvl} ({state.bank[lvl] ? Object.keys(state.bank[lvl]).length : 0}개 등록)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Quick Problem Bank Range Loader Bar */}
                              <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                                  <BookOpen className="w-4 h-4 text-blue-600" />
                                  <span>[{baseLvl}] 문제은행에서 불러오기:</span>
                                </div>

                                {baseBankRanges.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {baseBankRanges.map((rng) => (
                                      <button
                                        key={rng}
                                        type="button"
                                        onClick={() => handleSelectBankRangeForRow(sec.id, row.id, rng, baseLvl)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer border ${
                                          row.rangeName === rng
                                            ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-100 hover:text-blue-800'
                                        }`}
                                      >
                                        {rng}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">
                                    [{baseLvl}]에 등록된 문제은행 범위가 없습니다. 오른쪽에서 먼저 등록해주세요.
                                  </span>
                                )}
                              </div>

                              {/* 4 Problem Content Inputs (Directly editable) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                                <div>
                                  <label className="block text-[11px] font-bold text-blue-800 mb-0.5">
                                    문제 1번 내용
                                  </label>
                                  <input
                                    type="text"
                                    value={row.customProb1 || ''}
                                    onChange={(e) => handleUpdateRowCustomProblem(sec.id, row.id, 'customProb1', e.target.value)}
                                    placeholder="문제 1번 내용 (예: 날 일, 달 월, 불 화)..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-blue-800 mb-0.5">
                                    문제 2번 내용
                                  </label>
                                  <input
                                    type="text"
                                    value={row.customProb2 || ''}
                                    onChange={(e) => handleUpdateRowCustomProblem(sec.id, row.id, 'customProb2', e.target.value)}
                                    placeholder="문제 2번 내용 (예: 물 수, 나무 목, 쇠 금)..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-blue-800 mb-0.5">
                                    문제 3번 내용
                                  </label>
                                  <input
                                    type="text"
                                    value={row.customProb3 || ''}
                                    onChange={(e) => handleUpdateRowCustomProblem(sec.id, row.id, 'customProb3', e.target.value)}
                                    placeholder="문제 3번 내용 (예: 흙 토, 뫼 산, 내 천)..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-blue-800 mb-0.5">
                                    문제 4번 내용
                                  </label>
                                  <input
                                    type="text"
                                    value={row.customProb4 || ''}
                                    onChange={(e) => handleUpdateRowCustomProblem(sec.id, row.id, 'customProb4', e.target.value)}
                                    placeholder="문제 4번 내용 (예: 하늘 천, 땅 지, 사람 인)..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      등록된 진도 항목이 없습니다. 위에서 [+준4급 0] 또는 직접 입력하여 추가해주세요.
                    </div>
                  )}
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
                기준 급수 선택
              </label>
              <select
                value={activeBankLevel}
                onChange={(e) => setActiveBankLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {state.levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Range Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                범위명 (페이지/과 기입 시 자동 정렬)
              </label>
              <input
                type="text"
                value={newRangeName}
                onChange={(e) => setNewRangeName(e.target.value)}
                placeholder="예: 10과 역사와 철학 (265p), 165페이지, 25쪽"
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
