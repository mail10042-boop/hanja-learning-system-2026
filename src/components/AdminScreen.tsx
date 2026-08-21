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
  Sparkles,
  HelpCircle,
  Shuffle,
  RefreshCw,
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

  // Admin Sub-Tab: 'curriculum' (섹션 A·B·C 통합 진도 및 문제 관리) | 'quizPool' (실시간 문제 출제 한자 풀 관리) | 'bank' (문제은행 관리)
  const [adminTab, setAdminTab] = useState<'curriculum' | 'quizPool' | 'bank'>('curriculum');

  // Active dynamic sections list with safe fallback
  const activeSections: SectionItem[] = state.sections && state.sections.length > 0
    ? state.sections
    : INITIAL_STATE.sections;

  // Derive master unified row items (combines all rows in order)
  const masterSection = activeSections[0] || { items: [] };
  const unifiedItems: SectionRowItem[] = masterSection.items || [];

  // Adding new unified row input
  const [newRowInput, setNewRowInput] = useState<string>('');

  // Expanded row details for custom questions override
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [probSectionViewTab, setProbSectionViewTab] = useState<string>('all'); // 'all' | sectionId

  // --- QUIZ POOL MANAGEMENT STATE ---
  const [activeQuizLevel, setActiveQuizLevel] = useState<string>(state.levels[0] || '8급');
  const [newQuizInput, setNewQuizInput] = useState<string>('');
  const [simulatedQuizItems, setSimulatedQuizItems] = useState<string[]>([]);

  // --- PROBLEM BANK STATE ---
  const [activeBankLevel, setActiveBankLevel] = useState<string>(state.levels[0] || '8급');
  const [newRangeName, setNewRangeName] = useState<string>('');
  const [prob1Text, setProb1Text] = useState<string>('');
  const [prob2Text, setProb2Text] = useState<string>('');
  const [prob3Text, setProb3Text] = useState<string>('');
  const [prob4Text, setProb4Text] = useState<string>('');

  // Toast feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // In-App Custom Confirmation Dialog State (Works 100% reliably in sandboxed iframe)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'primary' | 'emerald';
    onConfirm: () => void;
  } | null>(null);

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

  // =========================================================================
  // 1. UNIFIED CURRICULUM SYNC (섹션 A에 넣으면 동시에 B, C에도 일괄 동기화)
  // =========================================================================

  // Add Item to ALL sections (A, B, C...) simultaneously
  const handleAddUnifiedRow = (customLabel?: string) => {
    const rawInput = (customLabel || newRowInput || '').trim();
    if (!rawInput) {
      showToast('추가할 급수/항목 이름을 입력하거나 프리셋을 눌러주세요 (예: 준4급 0).', 'error');
      return;
    }

    const baseLvl = extractBaseLevel(rawInput);
    const commonRowId = `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;

      const nextSections = currentSections.map((sec, secIdx) => {
        // Find default range for this grade if in bank
        const bankRanges = prev.bank[baseLvl] ? Object.keys(prev.bank[baseLvl]) : [];
        const defaultRange = bankRanges[secIdx % Math.max(1, bankRanges.length)] || `${rawInput} 진도`;

        const newRow: SectionRowItem = {
          id: commonRowId,
          levelLabel: rawInput,
          baseLevel: baseLvl,
          rangeName: defaultRange,
        };

        return {
          ...sec,
          items: [...(sec.items || []), newRow],
        };
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });

    setNewRowInput('');
    showToast(`[${rawInput}] 항목이 섹션 A·B·C에 동시에 추가되었습니다!`);
  };

  // Reorder Row across ALL sections simultaneously
  const handleMoveUnifiedRow = (rowIdx: number, direction: 'up' | 'down') => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        const items = [...(sec.items || [])];
        const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1;
        if (targetIdx < 0 || targetIdx >= items.length) return sec;

        const temp = items[rowIdx];
        items[rowIdx] = items[targetIdx];
        items[targetIdx] = temp;
        return { ...sec, items };
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  // Delete Row from ALL sections simultaneously
  const handleDeleteUnifiedRow = (rowId: string, label: string) => {
    setConfirmDialog({
      title: '진도 항목 삭제',
      message: `[${label}] 항목을 모든 섹션(A, B, C)에서 삭제하시겠습니까?`,
      confirmText: '삭제하기',
      confirmVariant: 'danger',
      onConfirm: () => {
        onUpdateState((prev) => {
          const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
          const nextSections = currentSections.map((sec) => ({
            ...sec,
            items: (sec.items || []).filter((r) => r.id !== rowId),
          }));

          return {
            ...prev,
            sections: nextSections,
          };
        });
        showToast(`[${label}] 항목이 모든 섹션에서 삭제되었습니다.`);
      },
    });
  };

  // Update Row Label across ALL sections
  const handleUpdateUnifiedRowLabel = (rowId: string, newLabel: string) => {
    const derivedBase = extractBaseLevel(newLabel);
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => ({
        ...sec,
        items: (sec.items || []).map((r) =>
          r.id === rowId ? { ...r, levelLabel: newLabel, baseLevel: r.baseLevel || derivedBase } : r
        ),
      }));

      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  // Update Base Level across ALL sections
  const handleUpdateUnifiedRowBaseLevel = (rowId: string, newBaseLevel: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => ({
        ...sec,
        items: (sec.items || []).map((r) => (r.id === rowId ? { ...r, baseLevel: newBaseLevel } : r)),
      }));

      return {
        ...prev,
        sections: nextSections,
      };
    });
    showToast(`문제은행 기준 급수가 [${newBaseLevel}](으)로 설정되었습니다.`);
  };

  // Update range for a specific section on a row
  const handleUpdateSectionRange = (secId: string, rowId: string, newRange: string) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => (r.id === rowId ? { ...r, rangeName: newRange } : r)),
          };
        }
        return sec;
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  // Load problem bank questions for a specific section on a row
  const handleSelectBankRangeForSection = (
    secId: string,
    rowId: string,
    selectedBankRange: string,
    baseLvl: string
  ) => {
    const bankData = state.bank[baseLvl]?.[selectedBankRange];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => {
              if (r.id === rowId) {
                return {
                  ...r,
                  rangeName: selectedBankRange,
                  baseLevel: baseLvl,
                  customProb1: bankData?.prob1 ?? '',
                  customProb2: bankData?.prob2 ?? '',
                  customProb3: bankData?.prob3 ?? '',
                  customProb4: bankData?.prob4 ?? '',
                };
              }
              return r;
            }),
          };
        }
        return sec;
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });

    const secName = activeSections.find((s) => s.id === secId)?.name || secId;
    showToast(`[${secName}]에 문제은행 [${selectedBankRange}] 범위와 문제(1~4번)가 적용되었습니다!`);
  };

  // Load problem bank questions for ALL sections simultaneously
  const handleApplyBankRangeToAllSections = (
    rowId: string,
    selectedBankRange: string,
    baseLvl: string
  ) => {
    const bankData = state.bank[baseLvl]?.[selectedBankRange];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => ({
        ...sec,
        items: (sec.items || []).map((r) => {
          if (r.id === rowId) {
            return {
              ...r,
              rangeName: selectedBankRange,
              baseLevel: baseLvl,
              customProb1: bankData?.prob1 ?? '',
              customProb2: bankData?.prob2 ?? '',
              customProb3: bankData?.prob3 ?? '',
              customProb4: bankData?.prob4 ?? '',
            };
          }
          return r;
        }),
      }));

      return {
        ...prev,
        sections: nextSections,
      };
    });

    showToast(`모든 섹션(A·B·C)에 [${selectedBankRange}] 범위와 문제가 일괄 적용되었습니다!`);
  };

  // Update individual problem question override for a SPECIFIC section
  const handleUpdateSectionCustomProblem = (
    secId: string,
    rowId: string,
    probKey: 'customProb1' | 'customProb2' | 'customProb3' | 'customProb4',
    val: string
  ) => {
    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => (r.id === rowId ? { ...r, [probKey]: val } : r)),
          };
        }
        return sec;
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });
  };

  // Copy problems from one section to ALL other sections
  const handleCopySectionProblemsToOthers = (sourceSecId: string, rowId: string) => {
    const sourceSec = activeSections.find((s) => s.id === sourceSecId);
    const sourceRow = sourceSec?.items?.find((r) => r.id === rowId);

    if (!sourceRow) return;

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id !== sourceSecId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => {
              if (r.id === rowId) {
                return {
                  ...r,
                  customProb1: sourceRow.customProb1,
                  customProb2: sourceRow.customProb2,
                  customProb3: sourceRow.customProb3,
                  customProb4: sourceRow.customProb4,
                };
              }
              return r;
            }),
          };
        }
        return sec;
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });

    const sourceName = sourceSec?.name || sourceSecId;
    showToast(`[${sourceName}]의 문제 1~4번이 다른 모든 섹션에 복사되었습니다!`);
  };

  // Reset a section's custom problems to default bank questions
  const handleResetSectionProblemsToBank = (secId: string, rowId: string, baseLvl: string, rangeName: string) => {
    const bankData = state.bank[baseLvl]?.[rangeName];

    onUpdateState((prev) => {
      const currentSections = prev.sections && prev.sections.length > 0 ? prev.sections : activeSections;
      const nextSections = currentSections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            items: (sec.items || []).map((r) => {
              if (r.id === rowId) {
                return {
                  ...r,
                  customProb1: bankData?.prob1 || '',
                  customProb2: bankData?.prob2 || '',
                  customProb3: bankData?.prob3 || '',
                  customProb4: bankData?.prob4 || '',
                };
              }
              return r;
            }),
          };
        }
        return sec;
      });

      return {
        ...prev,
        sections: nextSections,
      };
    });

    showToast(`문제 1~4번이 [${rangeName}] 문제은행 기본값으로 초기화되었습니다.`);
  };

  // =========================================================================
  // 2. QUIZ POOL (실시간 문제 출제 한자 풀) MANAGEMENT
  // =========================================================================
  const currentPool: string[] = state.quizPool?.[activeQuizLevel] || [];

  // Add Hanja items to Quiz Pool
  const handleAddHanjaToQuizPool = () => {
    const raw = newQuizInput.trim();
    if (!raw) {
      showToast('추가할 한자 뜻·음을 입력해주세요 (예: 날 일, 달 월, 불 화).', 'error');
      return;
    }

    const itemsToAdd = raw
      .split(/[,;\n]/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);

    if (itemsToAdd.length === 0) return;

    onUpdateState((prev) => {
      const existing = prev.quizPool?.[activeQuizLevel] || [];
      const merged = Array.from(new Set([...existing, ...itemsToAdd]));
      return {
        ...prev,
        quizPool: {
          ...prev.quizPool,
          [activeQuizLevel]: merged,
        },
      };
    });

    setNewQuizInput('');
    showToast(`[${activeQuizLevel}] 한자 풀에 ${itemsToAdd.length}개 한자가 추가되어 수업/실시간 출제에 즉시 반영되었습니다!`);
  };

  // Delete a single Hanja item from Quiz Pool
  const handleDeleteQuizItem = (itemToDelete: string) => {
    onUpdateState((prev) => {
      const existing = prev.quizPool?.[activeQuizLevel] || [];
      return {
        ...prev,
        quizPool: {
          ...prev.quizPool,
          [activeQuizLevel]: existing.filter((item) => item !== itemToDelete),
        },
      };
    });
    showToast(`[${itemToDelete}] 한자가 삭제되었습니다.`);
  };

  // Clear ALL Hanja items from Quiz Pool for a specific level
  const handleClearLevelQuizPool = (lvl = activeQuizLevel) => {
    const existing = state.quizPool?.[lvl] || [];
    if (existing.length === 0) {
      showToast(`[${lvl}]에 등록된 한자가 이미 없습니다.`, 'error');
      return;
    }

    setConfirmDialog({
      title: `[${lvl}] 한자 전체 삭제 비우기`,
      message: `정말로 [${lvl}]에 등록된 모든 한자 (${existing.length}개)를 한꺼번에 전체 삭제하시겠습니까?\n\n(삭제 후 필요 시 '대한검정회 표준한자로 복원' 또는 '문제은행에서 자동 추출'할 수 있습니다.)`,
      confirmText: '전체 삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
        onUpdateState((prev) => ({
          ...prev,
          quizPool: {
            ...prev.quizPool,
            [lvl]: [],
          },
        }));
        setSimulatedQuizItems([]);
        showToast(`[${lvl}] 등록된 모든 한자(${existing.length}개)가 일괄 삭제되었습니다.`);
      },
    });
  };

  // Clear ALL Hanja items across ALL levels
  const handleClearAllLevelsQuizPool = () => {
    const totalCount = Object.values(state.quizPool || {}).reduce(
      (acc: number, list: string[] | undefined) => acc + (list?.length || 0),
      0
    );
    if (totalCount === 0) {
      showToast('등록된 한자 풀 데이터가 이미 없습니다.', 'error');
      return;
    }

    setConfirmDialog({
      title: '모든 급수 풀 전체 비우기',
      message: `⚠️ 경고: 모든 급수의 실시간 출제용 한자 풀 데이터(총 ${totalCount}개)를 한꺼번에 전체 삭제하시겠습니까?\n\n(언제든지 '대한검정회 표준한자 전체 일괄적용' 버튼으로 복원 가능합니다.)`,
      confirmText: '전체 비우기',
      confirmVariant: 'danger',
      onConfirm: () => {
        onUpdateState((prev) => ({
          ...prev,
          quizPool: {},
        }));
        setSimulatedQuizItems([]);
        showToast('모든 급수의 한자 풀이 전체 일괄 삭제되었습니다.');
      },
    });
  };

  // Apply Daehan Hanja Certification standard to all levels
  const handleApplyAllDaehanHanjaPool = () => {
    setConfirmDialog({
      title: '대한검정회 표준한자 전체 일괄적용',
      message: '대한검정회 기준 공식 배정한자 목록(8급, 7급, 6급, 준5급, 5급, 준4급, 4급, 준3급 등)을 모든 급수의 한자 풀에 일괄 적용하시겠습니까?\n\n(기존의 한자 풀 데이터가 대한검정회 공식 배정한자 목록으로 깨끗하게 갱신됩니다.)',
      confirmText: '일괄 적용',
      confirmVariant: 'emerald',
      onConfirm: () => {
        onUpdateState((prev) => ({
          ...prev,
          quizPool: {
            ...INITIAL_STATE.quizPool,
          },
        }));
        setSimulatedQuizItems([]);
        showToast('대한검정회 기준 급수별 배정한자가 모든 급수에 일괄 적용되었습니다!');
      },
    });
  };

  // Reset Quiz Pool to initial preset for this level
  const handleResetLevelQuizPool = () => {
    const defaultPool = INITIAL_STATE.quizPool[activeQuizLevel] || [];
    setConfirmDialog({
      title: `[${activeQuizLevel}] 대한검정회 표준한자로 복원`,
      message: `[${activeQuizLevel}]의 한자 풀을 대한검정회 공식 배정한자 목록(${defaultPool.length}개)으로 복원하시겠습니까?`,
      confirmText: '복원하기',
      confirmVariant: 'emerald',
      onConfirm: () => {
        onUpdateState((prev) => ({
          ...prev,
          quizPool: {
            ...prev.quizPool,
            [activeQuizLevel]: defaultPool,
          },
        }));
        showToast(`[${activeQuizLevel}] 대한검정회 표준 한자 풀 (${defaultPool.length}개)로 복원되었습니다.`);
      },
    });
  };

  // Auto-extract Hanja from Problem Bank into Quiz Pool
  const handleExtractFromProblemBank = () => {
    const levelBank = state.bank[activeQuizLevel];
    if (!levelBank || Object.keys(levelBank).length === 0) {
      showToast(`[${activeQuizLevel}] 문제은행에 등록된 문제가 없습니다.`, 'error');
      return;
    }

    const harvested: string[] = [];
    Object.values(levelBank).forEach((entry: RangeProblemData) => {
      [entry.prob1, entry.prob2, entry.prob3, entry.prob4].forEach((txt) => {
        if (txt && typeof txt === 'string') {
          const pieces = txt
            .split(/[,;\n]/)
            .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter(Boolean);
          harvested.push(...pieces);
        }
      });
    });

    const uniqueHarvested = Array.from(new Set(harvested));
    if (uniqueHarvested.length === 0) {
      showToast('추출할 수 있는 한자 데이터가 없습니다.', 'error');
      return;
    }

    onUpdateState((prev) => {
      const existing = prev.quizPool?.[activeQuizLevel] || [];
      const combined = Array.from(new Set([...existing, ...uniqueHarvested]));
      return {
        ...prev,
        quizPool: {
          ...prev.quizPool,
          [activeQuizLevel]: combined,
        },
      };
    });

    showToast(`문제은행에서 ${uniqueHarvested.length}개 한자를 추출하여 [${activeQuizLevel}] 풀에 자동 등록하였습니다!`);
  };

  // Simulate / Preview random draw
  const handleSimulateQuizDraw = (count = 10) => {
    const pool = state.quizPool?.[activeQuizLevel] || [];
    if (pool.length === 0) {
      showToast('출제할 한자 풀이 비어있습니다.', 'error');
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    setSimulatedQuizItems(result);
  };

  // =========================================================================
  // 3. PROBLEM BANK MANAGEMENT
  // =========================================================================
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
    setConfirmDialog({
      title: '문제 범위 삭제',
      message: `[${lvl}]의 [${rng}] 문제 범위를 삭제하시겠습니까?`,
      confirmText: '삭제하기',
      confirmVariant: 'danger',
      onConfirm: () => {
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
      },
    });
  };

  // =========================================================================
  // 4. BACKUP & SYSTEM RESET
  // =========================================================================
  const handleResetToDefault = () => {
    setConfirmDialog({
      title: '기본 교육과정 초기화',
      message: '모든 데이터를 초기 기본 교육과정으로 초기화하시겠습니까?\n\n(사용자가 수정한 진도 및 문제 데이터가 기본값으로 복원됩니다.)',
      confirmText: '초기화하기',
      confirmVariant: 'danger',
      onConfirm: () => {
        onUpdateState(() => ({ ...INITIAL_STATE, levels: sortHanjaLevels(INITIAL_STATE.levels) }));
        showToast('기본 데이터로 초기화되었습니다.');
      },
    });
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
          if (parsed.bank || parsed.sections) {
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
              통합 급수 진도 관리, 실시간 문제 출제 한자 풀 및 문제은행 관리를 위해 비밀번호를 입력하세요.
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
            <h2 className="text-lg font-bold">관리자 제어판 (통합 진도 & 실시간 문제 출제 관리)</h2>
            <p className="text-xs text-slate-400">
              섹션 A에 항목을 넣으면 <strong>B, C에도 동시 일괄 반영</strong>되며, <strong>실시간 문제 출제 한자 풀</strong>을 손쉽게 등록 및 관리할 수 있습니다.
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

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAdminTab('curriculum')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
            adminTab === 'curriculum'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>섹션 A·B·C 통합 진도 & 문제 관리 ({unifiedItems.length}개 항목)</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('quizPool')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
            adminTab === 'quizPool'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>실시간 문제 출제 한자 풀(Quiz Pool) 관리</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('bank')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
            adminTab === 'bank'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>문제은행 (Problem Bank) 관리</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: UNIFIED CURRICULUM (섹션 A, B, C 하나로 합쳐서 일괄 동기화 관리)
      ========================================================================= */}
      {adminTab === 'curriculum' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Quick Add Box for Unified Curriculum */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  통합 급수/진도 항목 추가 (A, B, C 섹션 동시 자동 적용)
                </h3>
              </div>
              <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                ✨ 여기서 추가/수정/순서 변경 시 섹션 A, B, C 전체에 즉시 일괄 연동됩니다
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs font-bold text-slate-600 self-center mr-1">빠른 추가:</span>
              {COMMON_PRESET_LABELS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddUnifiedRow(preset)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-slate-700 border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition cursor-pointer active:scale-95"
                >
                  +{preset}
                </button>
              ))}
            </div>

            {/* Direct Input for arbitrary custom names */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={newRowInput}
                onChange={(e) => setNewRowInput(e.target.value)}
                placeholder="직접 급수/항목 이름 입력 (예: 준4급 0, 준4급 1, 준5급 0, 8급 A반 등)..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddUnifiedRow()}
              />
              <button
                type="button"
                onClick={() => handleAddUnifiedRow()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>A·B·C 일괄 추가</span>
              </button>
            </div>
          </div>

          {/* Unified Curriculum Rows Table/Card List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">
                  등록된 통합 진도 목록 ({unifiedItems.length}개)
                </span>
                <span className="text-xs text-slate-500">
                  (위/아래 이동 시 수업 화면의 모든 섹션 순서가 즉시 함께 바뀝니다)
                </span>
              </div>
            </div>

            {unifiedItems.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {unifiedItems.map((row, rowIdx) => {
                  const baseLvl = row.baseLevel || extractBaseLevel(row.levelLabel);
                  const baseBankRanges = sortRangesByPage(
                    state.bank[baseLvl] ? Object.keys(state.bank[baseLvl]) : []
                  );
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <div key={row.id} className="p-4 hover:bg-slate-50/60 transition space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                        {/* Reorder Buttons & Editable Label */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* UP / DOWN REORDER BUTTONS */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveUnifiedRow(rowIdx, 'up')}
                              disabled={rowIdx === 0}
                              className={`p-1 rounded border text-[10px] transition cursor-pointer ${
                                rowIdx === 0
                                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-700 hover:bg-blue-100 hover:text-blue-700 border-slate-300 shadow-2xs active:scale-90'
                              }`}
                              title="위로 이동"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveUnifiedRow(rowIdx, 'down')}
                              disabled={rowIdx === unifiedItems.length - 1}
                              className={`p-1 rounded border text-[10px] transition cursor-pointer ${
                                rowIdx === unifiedItems.length - 1
                                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-700 hover:bg-blue-100 hover:text-blue-700 border-slate-300 shadow-2xs active:scale-90'
                              }`}
                              title="아래로 이동"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Editable Label Tag */}
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="text"
                              value={row.levelLabel}
                              onChange={(e) => handleUpdateUnifiedRowLabel(row.id, e.target.value)}
                              className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-black text-sm text-center border border-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-400"
                              title="급수/항목 이름 직접 수정 (예: 준4급 0)"
                            />
                            <span className="text-[10px] text-center text-slate-400 font-bold">
                              순서 #{rowIdx + 1}
                            </span>
                          </div>
                        </div>

                        {/* SECTION A, B, C RANGES INPUTS (Simultaneous view!) */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                          {activeSections.map((sec, sIdx) => {
                            const secRowItem = sec.items?.find((r) => r.id === row.id) || row;
                            const secColor =
                              sIdx === 0
                                ? 'border-slate-300 bg-slate-50/50'
                                : sIdx === 1
                                ? 'border-blue-300 bg-blue-50/40'
                                : 'border-emerald-300 bg-emerald-50/40';

                            return (
                              <div key={sec.id} className={`p-2 rounded-xl border ${secColor} space-y-1`}>
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                  <span>{sec.name} 진도</span>
                                  {baseBankRanges.length > 0 && (
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleSelectBankRangeForSection(sec.id, row.id, e.target.value, baseLvl);
                                        }
                                      }}
                                      value={baseBankRanges.includes(secRowItem.rangeName) ? secRowItem.rangeName : ''}
                                      className="text-[10px] bg-white border border-slate-300 rounded px-1 py-0.5 text-blue-700 font-bold max-w-[95px] cursor-pointer"
                                      title="문제은행 범위에서 선택"
                                    >
                                      <option value="">문제은행</option>
                                      {baseBankRanges.map((rng) => (
                                        <option key={rng} value={rng}>
                                          {rng}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                <input
                                  type="text"
                                  value={secRowItem.rangeName || ''}
                                  onChange={(e) => handleUpdateSectionRange(sec.id, row.id, e.target.value)}
                                  placeholder={`${sec.name} 진도 입력...`}
                                  className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Action buttons (Problem details toggle & delete) */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                              isExpanded
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>문제 설정 (1~4번)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUnifiedRow(row.id, row.levelLabel)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition text-xs"
                            title="모든 섹션에서 이 항목 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Problem Settings Area for this row */}
                      {isExpanded && (
                        <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-blue-300 space-y-4 animate-in fade-in duration-150 shadow-inner">
                          {/* Header Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-xs shadow-2xs">
                                {row.levelLabel}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                확인 문제 1~4번 설정 (각 섹션 A·B·C별로 문제를 다르게 설정할 수 있습니다)
                              </span>
                            </div>

                            {/* Base Level selector */}
                            <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              <span className="text-slate-500 font-semibold">문제은행 기준 급수:</span>
                              <select
                                value={baseLvl}
                                onChange={(e) => handleUpdateUnifiedRowBaseLevel(row.id, e.target.value)}
                                className="font-bold text-blue-700 cursor-pointer bg-transparent outline-none"
                              >
                                {state.levels.map((lvl) => (
                                  <option key={lvl} value={lvl}>
                                    {lvl} ({state.bank[lvl] ? Object.keys(state.bank[lvl]).length : 0}개 등록)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Section View Tabs & Batch Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-slate-500 px-1">보기 모드:</span>
                              <button
                                type="button"
                                onClick={() => setProbSectionViewTab('all')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                                  probSectionViewTab === 'all'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                📑 전체 섹션(A·B·C) 나란히 편집
                              </button>
                              {activeSections.map((sec, sIdx) => {
                                const isTabActive = probSectionViewTab === sec.id;
                                const tabColor =
                                  sIdx === 0
                                    ? 'hover:text-slate-900'
                                    : sIdx === 1
                                    ? 'hover:text-blue-700'
                                    : 'hover:text-emerald-700';
                                return (
                                  <button
                                    key={sec.id}
                                    type="button"
                                    onClick={() => setProbSectionViewTab(sec.id)}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                                      isTabActive
                                        ? sIdx === 0
                                          ? 'bg-slate-700 text-white shadow-2xs'
                                          : sIdx === 1
                                          ? 'bg-blue-600 text-white shadow-2xs'
                                          : 'bg-emerald-600 text-white shadow-2xs'
                                        : `bg-slate-100 text-slate-600 ${tabColor}`
                                    }`}
                                  >
                                    {sec.name} 단독
                                  </button>
                                );
                              })}
                            </div>

                            {/* Batch apply to all sections dropdown */}
                            {baseBankRanges.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-semibold">전체 일괄 적용:</span>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleApplyBankRangeToAllSections(row.id, e.target.value, baseLvl);
                                    }
                                  }}
                                  defaultValue=""
                                  className="px-2 py-1 rounded-md border border-slate-300 font-bold text-xs bg-slate-50 text-slate-700 cursor-pointer"
                                >
                                  <option value="" disabled>
                                    문제은행 범위 선택...
                                  </option>
                                  {baseBankRanges.map((rng) => (
                                    <option key={rng} value={rng}>
                                      모든 섹션에 [{rng}] 일괄 적용
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* SECTION-SPECIFIC PROBLEM EDITING CARDS */}
                          <div
                            className={`grid gap-3 ${
                              probSectionViewTab === 'all'
                                ? 'grid-cols-1 lg:grid-cols-3'
                                : 'grid-cols-1'
                            }`}
                          >
                            {activeSections
                              .filter((sec) => probSectionViewTab === 'all' || probSectionViewTab === sec.id)
                              .map((sec, sIdx) => {
                                const secRowItem = sec.items?.find((r) => r.id === row.id) || row;
                                const secBankData = state.bank[baseLvl]?.[secRowItem.rangeName];
                                const secBorder =
                                  sIdx === 0
                                    ? 'border-slate-300 bg-white'
                                    : sIdx === 1
                                    ? 'border-blue-300 bg-white'
                                    : 'border-emerald-300 bg-white';
                                const headerBg =
                                  sIdx === 0
                                    ? 'bg-slate-100 text-slate-800'
                                    : sIdx === 1
                                    ? 'bg-blue-100/70 text-blue-900'
                                    : 'bg-emerald-100/70 text-emerald-900';

                                return (
                                  <div
                                    key={sec.id}
                                    className={`rounded-xl border ${secBorder} shadow-2xs overflow-hidden flex flex-col justify-between space-y-3 p-3.5`}
                                  >
                                    {/* Section Card Header */}
                                    <div className="space-y-2">
                                      <div className={`px-3 py-1.5 rounded-lg ${headerBg} flex items-center justify-between`}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-xs">{sec.name}</span>
                                          <span className="text-[11px] font-bold opacity-80">
                                            ({secRowItem.rangeName || '진도 미설정'})
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleCopySectionProblemsToOthers(sec.id, row.id)}
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 hover:bg-white text-slate-700 shadow-2xs transition cursor-pointer"
                                          title="이 섹션의 문제 1~4번을 다른 모든 섹션에 똑같이 복사"
                                        >
                                          📋 타 섹션에 복사
                                        </button>
                                      </div>

                                      {/* Quick Problem Bank Loader for this specific section */}
                                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                          <span className="flex items-center gap-1">
                                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                            <span>[{sec.name}] 문제은행 불러오기:</span>
                                          </span>
                                          {secBankData && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleResetSectionProblemsToBank(
                                                  sec.id,
                                                  row.id,
                                                  baseLvl,
                                                  secRowItem.rangeName
                                                )
                                              }
                                              className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                                            >
                                              기본값 복원
                                            </button>
                                          )}
                                        </div>

                                        {baseBankRanges.length > 0 ? (
                                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                            {baseBankRanges.map((rng) => {
                                              const isCurrent = secRowItem.rangeName === rng;
                                              return (
                                                <button
                                                  key={rng}
                                                  type="button"
                                                  onClick={() =>
                                                    handleSelectBankRangeForSection(sec.id, row.id, rng, baseLvl)
                                                  }
                                                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer border ${
                                                    isCurrent
                                                      ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'
                                                  }`}
                                                >
                                                  {rng}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 italic text-[10px] block">
                                            [{baseLvl}] 문제은행 범위 없음
                                          </span>
                                        )}
                                      </div>

                                      {/* 4 Problem Inputs for this section */}
                                      <div className="space-y-2 text-xs pt-1">
                                        {([1, 2, 3, 4] as const).map((pNum) => {
                                          const customKey = `customProb${pNum}` as const;
                                          const currentVal = secRowItem[customKey] ?? '';
                                          const fallbackBankVal =
                                            secBankData?.[`prob${pNum}` as keyof typeof secBankData] || '';

                                          return (
                                            <div key={pNum} className="space-y-0.5">
                                              <div className="flex items-center justify-between text-[11px]">
                                                <label className="font-bold text-slate-700">
                                                  문제 {pNum}번 ({sec.name})
                                                </label>
                                                {currentVal ? (
                                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                                    직접입력됨
                                                  </span>
                                                ) : fallbackBankVal ? (
                                                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-50 text-blue-600 font-medium">
                                                    문제은행 연동
                                                  </span>
                                                ) : null}
                                              </div>
                                              <input
                                                type="text"
                                                value={currentVal}
                                                onChange={(e) =>
                                                  handleUpdateSectionCustomProblem(
                                                    sec.id,
                                                    row.id,
                                                    customKey,
                                                    e.target.value
                                                  )
                                                }
                                                placeholder={
                                                  fallbackBankVal
                                                    ? `기본: ${fallbackBankVal}`
                                                    : `문제 ${pNum}번 내용 입력 (예: 날 일, 달 월)`
                                                }
                                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-blue-500 bg-white text-xs"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-400">
                등록된 통합 진도 항목이 없습니다. 상단에서 [+준4급 0] 또는 직접 입력하여 추가해주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: QUIZ POOL (실시간 문제 출제 한자 풀 관리)
      ========================================================================= */}
      {adminTab === 'quizPool' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-800">
                  실시간 문제 출제 한자 풀(Quiz Pool) 관리
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                급수별 출제용 한자를 직접 등록하고 관리하면 실시간 문제 출제 화면에 즉시 반영됩니다.
              </span>
            </div>

            {/* Level Selector Bar & Batch Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">관리할 급수 선택:</span>
                <div className="flex flex-wrap gap-1">
                  {state.levels.map((lvl) => {
                    const count = state.quizPool?.[lvl]?.length || 0;
                    const isSelected = activeQuizLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setActiveQuizLevel(lvl)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{lvl}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAllDaehanHanjaPool}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="8급~준3급 등 모든 급수에 대한검정회 공식 신규/배정한자를 일괄 채워넣습니다"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>대한검정회 표준한자 전체 일괄적용</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllLevelsQuizPool}
                  className="text-[11px] text-slate-400 hover:text-rose-600 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-rose-300 transition cursor-pointer flex items-center gap-1"
                  title="모든 급수의 한자 풀 데이터를 일괄 비웁니다"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>모든 급수 풀 전체 비우기</span>
                </button>
              </div>
            </div>

            {/* Direct Input & Helper Action Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>➕ [{activeQuizLevel}] 한자 추가 (쉼표 `,` 또는 줄바꿈으로 여러 개 한 번에 입력 가능)</span>
                <span className="text-slate-500 font-normal">현재 등록: {currentPool.length}개</span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={newQuizInput}
                  onChange={(e) => setNewQuizInput(e.target.value)}
                  placeholder="예: 날 일, 달 월, 불 화, 물 수, 나무 목, 쇠 금..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHanjaToQuizPool()}
                />
                <button
                  type="button"
                  onClick={handleAddHanjaToQuizPool}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>한자 풀에 추가</span>
                </button>
              </div>

              {/* Smart Auto Helper Tools */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetLevelQuizPool}
                    className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    title="해당 급수를 대한검정회 공식 배정한자 목록으로 복원합니다"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>[{activeQuizLevel}] 대한검정회 표준한자로 복원</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExtractFromProblemBank}
                    className="flex items-center gap-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    title="문제은행 1~4번에 등록된 모든 한자를 자동으로 한자 풀에 채웁니다"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>[{activeQuizLevel}] 문제은행에서 한자 자동 추출</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearLevelQuizPool(activeQuizLevel)}
                    disabled={currentPool.length === 0}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer border ${
                      currentPool.length === 0
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs'
                    }`}
                    title={`[${activeQuizLevel}] 등록된 한자를 한꺼번에 모두 삭제합니다`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>[{activeQuizLevel}] 한자 전체 삭제 (비우기)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSimulateQuizDraw(10)}
                  className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>실시간 문제 출제 시뮬레이션 (10개)</span>
                </button>
              </div>
            </div>

            {/* Simulation Preview Area (if triggered) */}
            {simulatedQuizItems.length > 0 && (
              <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-300 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span>🎯 [{activeQuizLevel}] 실시간 문제 출제 미리보기 (학생들이 보게 될 무작위 카드):</span>
                  <button
                    type="button"
                    onClick={() => handleSimulateQuizDraw(10)}
                    className="text-amber-800 underline hover:text-amber-950 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>다시 섞기</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {simulatedQuizItems.map((item, i) => (
                    <div
                      key={`sim-${i}-${item}`}
                      className="bg-white p-3 rounded-lg border border-amber-200 text-center font-black text-slate-900 text-base shadow-2xs"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Hanja Cards Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span>📋 [{activeQuizLevel}] 등록된 한자 카드</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-black text-[11px]">
                    {currentPool.length}개
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">한자 옆 ✕를 누르면 개별 삭제</span>
                  {currentPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearLevelQuizPool(activeQuizLevel)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-300 transition cursor-pointer shadow-2xs"
                      title={`[${activeQuizLevel}]에 등록된 ${currentPool.length}개 한자를 한꺼번에 전체 삭제`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>[{activeQuizLevel}] 한꺼번에 전체 삭제</span>
                    </button>
                  )}
                </div>
              </div>

              {currentPool.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {currentPool.map((hItem) => (
                    <div
                      key={hItem}
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 text-slate-800 font-bold text-sm hover:border-blue-400 transition"
                    >
                      <span>{hItem}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuizItem(hItem)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 transition cursor-pointer"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  등록된 한자가 없습니다. 위 입력창에서 한자를 추가하거나 "문제은행에서 한자 자동 추출"을 눌러주세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PROBLEM BANK (문제은행 관리)
      ========================================================================= */}
      {adminTab === 'bank' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-150">
          {/* Add Range to Bank */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
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

            {/* 4 Problems */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
                <span>문제 내용 (한 칸에 자유롭게 기입)</span>
                <span className="text-[11px] text-blue-600">※ 3개든 4개든 자유 입력</span>
              </div>

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

          {/* Registered Ranges in Bank */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  [{activeBankLevel}] 등록된 문제 ({bankRangesForActiveLevel.length}개)
                </h4>
              </div>
              <span className="text-xs text-slate-400">페이지순 정렬</span>
            </div>

            {bankRangesForActiveLevel.length > 0 ? (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
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
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                등록된 문제은행이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom In-App Confirmation Modal (Bypasses iframe sandbox confirm restrictions) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : confirmDialog.confirmVariant === 'emerald'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {confirmDialog.cancelText || '취소'}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition cursor-pointer active:scale-98 ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : confirmDialog.confirmVariant === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {confirmDialog.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
