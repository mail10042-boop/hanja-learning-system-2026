import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
  Youtube,
  Upload,
  Trash2,
  Save,
  Plus,
  Edit2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  FileArchive,
  FolderUp,
  ListChecks,
  BookOpen,
  Download,
  Play,
  CheckSquare,
  RotateCcw,
} from 'lucide-react';
import {
  AppState,
  SongAudioFileMeta,
  SongHanjaLyricItem,
  SongLessonData,
  SongMediaItem,
  SongNumberSlot,
} from '../types';
import {
  getLessonHanjaCandidates,
  getLessonsForLevel,
  HanjaCandidate,
  lookupHanjaChar,
} from '../utils/hanjaDictionary';
import {
  createEmptySongLesson,
  getLessonSongHanjaLyrics,
  getManagedLessonsForLevel,
  getSongMediaList,
  makeSongLessonId,
  PRIMARY_SONG_LEVELS,
} from '../utils/songHelpers';
import { SongAudioPlayer } from './SongAudioPlayer';
import { SongTodayBuilder } from './SongTodayBuilder';
import { SongStudentStage } from './SongStudentStage';
import {
  BackupExportReport,
  BackupPreview,
  exportFullBackupZip,
  executeBackupRestore,
  inspectBackupFile,
  RestoreIntegrityReport,
} from '../utils/backupZip';
import { IntegrityReportModal, RestoreConfirmModal } from './BackupIntegrityModal';
import { playBeep } from '../utils/audio';
import { uploadSongAudioFile } from '../utils/songAudioUpload';

interface SongQuizScreenProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  showFloatingTimer?: boolean;
  onToggleFloatingTimer?: () => void;
}

export const SongQuizScreen: React.FC<SongQuizScreenProps> = ({
  state,
  onUpdateState,
  showFloatingTimer,
  onToggleFloatingTimer,
}) => {
  // Two primary tabs + classroom student presentation mode
  const [viewMode, setViewMode] = useState<'editor' | 'today' | 'student'>('editor');
  const [studentSession, setStudentSession] = useState<{
    activeNumbers: number[];
    initialSlotNumber?: number;
  } | null>(null);

  // Selected Level & Lesson
  const [selectedLevel, setSelectedLevel] = useState<string>('8급');
  const [showAllLevels, setShowAllLevels] = useState<boolean>(false);

  const managedLessons = useMemo(
    () => getManagedLessonsForLevel(state, selectedLevel),
    [state, selectedLevel]
  );

  const [selectedLessonName, setSelectedLessonName] = useState<string>(
    managedLessons[0] || '1과'
  );

  useEffect(() => {
    if (managedLessons.length > 0 && !managedLessons.includes(selectedLessonName)) {
      setSelectedLessonName(managedLessons[0]);
    } else if (managedLessons.length === 0 && selectedLessonName !== '') {
      setSelectedLessonName('');
    }
  }, [selectedLevel, managedLessons, selectedLessonName]);

  // Lesson CRUD & Bulk-Select Delete inputs
  const [newLessonInput, setNewLessonInput] = useState<string>('');
  const [renamingLesson, setRenamingLesson] = useState<string | null>(null);
  const [renameLessonValue, setRenameLessonValue] = useState<string>('');
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<string | null>(null);
  const [lessonSelectMode, setLessonSelectMode] = useState<boolean>(false);
  const [selectedLessonsToDelete, setSelectedLessonsToDelete] = useState<string[]>([]);
  const [confirmBulkDeleteLessons, setConfirmBulkDeleteLessons] = useState<boolean>(false);

  // Per-Hanja Lyric Bulk-Select Delete inputs
  const [selectedLyricIds, setSelectedLyricIds] = useState<string[]>([]);
  const [confirmBulkDeleteLyrics, setConfirmBulkDeleteLyrics] = useState<boolean>(false);

  useEffect(() => {
    setLessonSelectMode(false);
    setSelectedLessonsToDelete([]);
    setConfirmBulkDeleteLessons(false);
    setConfirmDeleteLesson(null);
    setRenamingLesson(null);
  }, [selectedLevel]);

  const currentLessonId = makeSongLessonId(selectedLevel, selectedLessonName);

  useEffect(() => {
    setSelectedLyricIds([]);
    setConfirmBulkDeleteLyrics(false);
  }, [currentLessonId]);
  const savedLesson: SongLessonData | undefined = selectedLessonName
    ? state.songLessons?.[currentLessonId]
    : undefined;
  const currentLesson: SongLessonData = useMemo(
    () => savedLesson || createEmptySongLesson(selectedLevel, selectedLessonName),
    [savedLesson, selectedLevel, selectedLessonName]
  );

  const songsList: SongMediaItem[] = useMemo(
    () => getSongMediaList(currentLesson),
    [currentLesson]
  );
  const hanjaLyricsList: SongHanjaLyricItem[] = useMemo(
    () => getLessonSongHanjaLyrics(currentLesson),
    [currentLesson]
  );

  // Previewing song in editor
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  useEffect(() => {
    if (songsList.length > 0 && !songsList.some((s) => s.id === previewSongId)) {
      setPreviewSongId(songsList[0].id);
    } else if (songsList.length === 0) {
      setPreviewSongId(null);
    }
  }, [songsList, previewSongId]);

  // New YouTube song form
  const [ytTitleInput, setYtTitleInput] = useState<string>('');
  const [ytUrlInput, setYtUrlInput] = useState<string>('');
  const [ytStartInput, setYtStartInput] = useState<number>(0);
  const [ytEndInput, setYtEndInput] = useState<string>('');

  // New Audio song title + upload state
  const [audioTitleInput, setAudioTitleInput] = useState<string>('');
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [isDraggingAudio, setIsDraggingAudio] = useState<boolean>(false);

  // Inline Song editing state
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongTitle, setEditSongTitle] = useState<string>('');
  const [editSongUrl, setEditSongUrl] = useState<string>('');
  const [editSongStart, setEditSongStart] = useState<number>(0);
  const [editSongEnd, setEditSongEnd] = useState<string>('');

  // New Per-Hanja Lyric input row
  const [newHanjaChar, setNewHanjaChar] = useState<string>('');
  const [newHanjaMeaning, setNewHanjaMeaning] = useState<string>('');
  const [newLyricLine, setNewLyricLine] = useState<string>('');

  // Inline Lyric row edit state
  const [editingLyricId, setEditingLyricId] = useState<string | null>(null);
  const [editLyricChar, setEditLyricChar] = useState<string>('');
  const [editLyricMeaning, setEditLyricMeaning] = useState<string>('');
  const [editLyricText, setEditLyricText] = useState<string>('');

  // Toast & Save status
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('자동 저장 대기 중');

  // ZIP Backup & Restore modal states
  const [isBackingUpZip, setIsBackingUpZip] = useState<boolean>(false);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [isRestoringZip, setIsRestoringZip] = useState<boolean>(false);
  const [exportReport, setExportReport] = useState<BackupExportReport | null>(null);
  const [restoreReport, setRestoreReport] = useState<RestoreIntegrityReport | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Update helper targeting explicit (level, lessonName) so async uploads never miss the active lesson
  const updateLessonByTarget = (
    targetLevel: string,
    targetLessonName: string,
    updater: (lesson: SongLessonData) => SongLessonData
  ) => {
    const targetLessonId = makeSongLessonId(targetLevel, targetLessonName);
    const nowStr = new Date();
    const timeFormatted = `${String(nowStr.getHours()).padStart(2, '0')}:${String(
      nowStr.getMinutes()
    ).padStart(2, '0')}:${String(nowStr.getSeconds()).padStart(2, '0')}`;

    onUpdateState((prev) => {
      const prevMap = prev.songLessons || {};
      const rawExisting =
        prevMap[targetLessonId] || createEmptySongLesson(targetLevel, targetLessonName);
      const normalizedBase: SongLessonData = {
        ...rawExisting,
        songs: getSongMediaList(rawExisting),
        hanjaLyrics: getLessonSongHanjaLyrics(rawExisting),
      };
      const updated = {
        ...updater(normalizedBase),
        id: targetLessonId,
        level: targetLevel,
        lessonName: targetLessonName,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        songLessons: {
          ...prevMap,
          [targetLessonId]: updated,
        },
      };
    });
    setLastSavedLabel(`자동 저장됨 (${timeFormatted})`);
  };

  // Update helper ensuring normalized arrays stay persisted cleanly
  const updateCurrentLesson = (updater: (lesson: SongLessonData) => SongLessonData) => {
    updateLessonByTarget(selectedLevel, selectedLessonName, updater);
  };

  // Explicit Cloud Save button
  const handleManualSave = async () => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (res.ok) {
        const nowStr = new Date();
        const timeFormatted = `${String(nowStr.getHours()).padStart(2, '0')}:${String(
          nowStr.getMinutes()
        ).padStart(2, '0')}:${String(nowStr.getSeconds()).padStart(2, '0')}`;
        setLastSavedLabel(`서버 저장 완료 (${timeFormatted})`);
        showToast(`[${selectedLevel} ${selectedLessonName}] 데이터가 서버에 안전하게 저장되었습니다.`);
      } else {
        showToast('서버 저장 중 문제가 발생했습니다.', 'error');
      }
    } catch {
      showToast('로컬에 저장되었습니다 (서버 연결 확인 필요).', 'error');
    }
  };

  // =========================================================================
  // 1. LEVEL & LESSON MANAGEMENT (추가 / 이름 변경 / 삭제, 개수 무제한)
  // =========================================================================
  const handleAddLesson = () => {
    const trimmed = newLessonInput.trim();
    if (!trimmed) {
      showToast('추가할 과 이름을 입력하세요 (예: 1과, 2과, 5과).', 'error');
      return;
    }
    if (managedLessons.includes(trimmed)) {
      setSelectedLessonName(trimmed);
      setNewLessonInput('');
      showToast(`[${selectedLevel} ${trimmed}] 과를 선택했습니다.`);
      return;
    }

    onUpdateState((prev) => {
      const currentList = getManagedLessonsForLevel(prev, selectedLevel);
      const nextLessons = [...currentList, trimmed];
      const newId = makeSongLessonId(selectedLevel, trimmed);
      return {
        ...prev,
        songCustomLessons: {
          ...(prev.songCustomLessons || {}),
          [selectedLevel]: nextLessons,
        },
        songLessons: {
          ...(prev.songLessons || {}),
          [newId]:
            prev.songLessons?.[newId] || createEmptySongLesson(selectedLevel, trimmed),
        },
      };
    });
    setSelectedLessonName(trimmed);
    setNewLessonInput('');
    showToast(`[${selectedLevel} ${trimmed}] 과가 추가되었습니다.`);
  };

  const handleConfirmRenameLesson = (oldName: string) => {
    const nextName = renameLessonValue.trim();
    if (!nextName || nextName === oldName) {
      setRenamingLesson(null);
      return;
    }
    if (managedLessons.includes(nextName)) {
      showToast('이미 같은 이름의 과가 존재합니다.', 'error');
      return;
    }

    onUpdateState((prev) => {
      const currentList = getManagedLessonsForLevel(prev, selectedLevel);
      const updatedList = currentList.map((n) => (n === oldName ? nextName : n));
      const oldId = makeSongLessonId(selectedLevel, oldName);
      const newId = makeSongLessonId(selectedLevel, nextName);
      const prevSongLessons = { ...(prev.songLessons || {}) };
      const existingData = prevSongLessons[oldId];
      if (existingData) {
        prevSongLessons[newId] = {
          ...existingData,
          id: newId,
          lessonName: nextName,
          updatedAt: new Date().toISOString(),
        };
        delete prevSongLessons[oldId];
      }

      // Also update any 1~10 slots pointing to this renamed lesson
      const prevSlots = { ...(prev.songNumberSlots || {}) };
      Object.keys(prevSlots).forEach((k) => {
        const num = Number(k);
        const s = prevSlots[num];
        if (s && s.level === selectedLevel && s.lessonName === oldName) {
          prevSlots[num] = { ...s, lessonName: nextName };
        }
      });

      return {
        ...prev,
        songCustomLessons: {
          ...(prev.songCustomLessons || {}),
          [selectedLevel]: updatedList,
        },
        songLessons: prevSongLessons,
        songNumberSlots: prevSlots,
      };
    });

    if (selectedLessonName === oldName) {
      setSelectedLessonName(nextName);
    }
    setRenamingLesson(null);
    showToast(`[${oldName}] → [${nextName}] 이름으로 변경되었습니다.`);
  };

  const handleDeleteLesson = (lessonNameToDelete: string) => {
    const targetId = makeSongLessonId(selectedLevel, lessonNameToDelete);
    const targetData = state.songLessons?.[targetId];

    // Delete any uploaded audio files belonging exclusively to this lesson
    if (targetData) {
      getSongMediaList(targetData).forEach((m) => {
        if (m.type === 'audio' && m.audioFile?.audioId) {
          fetch(`/api/song-audio/${encodeURIComponent(m.audioFile.audioId)}`, {
            method: 'DELETE',
          }).catch(() => {});
        }
      });
    }

    onUpdateState((prev) => {
      const currentList = getManagedLessonsForLevel(prev, selectedLevel);
      const nextList = currentList.filter((n) => n !== lessonNameToDelete);
      const nextLessonsMap = { ...(prev.songLessons || {}) };
      delete nextLessonsMap[targetId];
      return {
        ...prev,
        songCustomLessons: {
          ...(prev.songCustomLessons || {}),
          [selectedLevel]: nextList,
        },
        songLessons: nextLessonsMap,
      };
    });

    setConfirmDeleteLesson(null);
    setSelectedLessonsToDelete((prev) => prev.filter((n) => n !== lessonNameToDelete));
    if (selectedLessonName === lessonNameToDelete) {
      const remaining = managedLessons.filter((n) => n !== lessonNameToDelete);
      setSelectedLessonName(remaining[0] || '');
    }
    showToast(`[${selectedLevel} ${lessonNameToDelete}] 과가 삭제되었습니다.`);
  };

  const handleToggleSelectLessonForDelete = (lessonName: string) => {
    setSelectedLessonsToDelete((prev) =>
      prev.includes(lessonName) ? prev.filter((n) => n !== lessonName) : [...prev, lessonName]
    );
    setConfirmBulkDeleteLessons(false);
  };

  const handleBulkDeleteLessons = () => {
    if (selectedLessonsToDelete.length === 0) return;
    const toDeleteSet = new Set(selectedLessonsToDelete);

    selectedLessonsToDelete.forEach((lName) => {
      const tId = makeSongLessonId(selectedLevel, lName);
      const tData = state.songLessons?.[tId];
      if (tData) {
        getSongMediaList(tData).forEach((m) => {
          if (m.type === 'audio' && m.audioFile?.audioId) {
            fetch(`/api/song-audio/${encodeURIComponent(m.audioFile.audioId)}`, {
              method: 'DELETE',
            }).catch(() => {});
          }
        });
      }
    });

    onUpdateState((prev) => {
      const currentList = getManagedLessonsForLevel(prev, selectedLevel);
      const nextList = currentList.filter((n) => !toDeleteSet.has(n));
      const nextLessonsMap = { ...(prev.songLessons || {}) };
      selectedLessonsToDelete.forEach((lName) => {
        delete nextLessonsMap[makeSongLessonId(selectedLevel, lName)];
      });
      return {
        ...prev,
        songCustomLessons: {
          ...(prev.songCustomLessons || {}),
          [selectedLevel]: nextList,
        },
        songLessons: nextLessonsMap,
      };
    });

    const deletedCount = selectedLessonsToDelete.length;
    if (toDeleteSet.has(selectedLessonName)) {
      const remaining = managedLessons.filter((n) => !toDeleteSet.has(n));
      setSelectedLessonName(remaining[0] || '');
    }
    setSelectedLessonsToDelete([]);
    setConfirmBulkDeleteLessons(false);
    setLessonSelectMode(false);
    showToast(`[${selectedLevel}] 선택한 ${deletedCount}개 과가 한 번에 삭제되었습니다.`);
  };

  const handleRestoreSystemLessonsForLevel = () => {
    const sysLessons = getLessonsForLevel(state, selectedLevel);
    const toRestore = sysLessons.length > 0 ? sysLessons : ['1과'];
    const merged = Array.from(new Set([...managedLessons, ...toRestore]));
    onUpdateState((prev) => ({
      ...prev,
      songCustomLessons: {
        ...(prev.songCustomLessons || {}),
        [selectedLevel]: merged,
      },
    }));
    if (!selectedLessonName && merged.length > 0) {
      setSelectedLessonName(merged[0]);
    }
    showToast(`[${selectedLevel}] 기존 시스템 과 목록(${toRestore.length}개)을 불러왔습니다.`);
  };

  // =========================================================================
  // 2. MULTI-SONG MANAGEMENT PER LESSON (유튜브 & 음원 파일 여러 개)
  // =========================================================================
  const handleAddYouTubeSong = () => {
    const url = ytUrlInput.trim();
    if (!url) {
      showToast('유튜브 URL을 입력해 주세요.', 'error');
      return;
    }
    const title =
      ytTitleInput.trim() || `${selectedLevel} ${selectedLessonName} 유튜브 노래 ${songsList.length + 1}`;
    const endParsed = ytEndInput.trim() === '' ? null : Math.max(0, Number(ytEndInput) || 0);

    const newSong: SongMediaItem = {
      id: `song_yt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'youtube',
      title,
      youtubeUrl: url,
      audioFile: null,
      startTime: Math.max(0, Number(ytStartInput) || 0),
      endTime: endParsed,
      createdAt: new Date().toISOString(),
    };

    updateCurrentLesson((lesson) => ({
      ...lesson,
      songs: [...(lesson.songs || []), newSong],
    }));

    setPreviewSongId(newSong.id);
    setYtTitleInput('');
    setYtUrlInput('');
    setYtStartInput(0);
    setYtEndInput('');
    playBeep(state.soundEnabled, 740, 0.05);
    showToast(`유튜브 노래 [${title}]이 추가되었습니다.`);
  };

  const processAudioFilesUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
    if (files.length === 0) {
      showToast('업로드할 수 있는 유효한 음원 파일을 선택해 주세요.', 'error');
      return;
    }

    const targetLevel = selectedLevel;
    const targetLessonName = selectedLessonName;
    if (!targetLevel || !targetLessonName) {
      showToast('먼저 급수와 과를 선택해 주세요.', 'error');
      return;
    }

    const customTitle = audioTitleInput.trim();
    setIsUploadingAudio(true);
    setUploadProgressPct(0);

    let lastCreatedId: string | null = null;
    let uploadedCount = 0;

    try {
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const meta: SongAudioFileMeta = await uploadSongAudioFile(file, (pct) => {
          const overall = Math.round(((idx + pct / 100) / files.length) * 100);
          setUploadProgressPct(overall);
        });

        const baseName = file.name.replace(/\.[^.]+$/, '') || `${targetLessonName} 음원`;
        const title =
          files.length === 1 && customTitle ? customTitle : customTitle ? `${customTitle} (${idx + 1})` : baseName;

        const newSong: SongMediaItem = {
          id: `song_aud_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'audio',
          title,
          youtubeUrl: '',
          audioFile: meta,
          startTime: 0,
          endTime: null,
          createdAt: new Date().toISOString(),
        };

        updateLessonByTarget(targetLevel, targetLessonName, (lesson) => ({
          ...lesson,
          songs: [...(lesson.songs || []), newSong],
        }));

        lastCreatedId = newSong.id;
        uploadedCount++;
      }

      if (lastCreatedId) setPreviewSongId(lastCreatedId);
      setAudioTitleInput('');
      playBeep(state.soundEnabled, 780, 0.06);
      showToast(
        uploadedCount === 1
          ? `[${targetLevel} ${targetLessonName}] 음원 (${files[0].name})이 서버에 영구 저장되었습니다.`
          : `[${targetLevel} ${targetLessonName}] 음원 ${uploadedCount}개가 서버에 영구 저장되었습니다.`
      );
    } catch (err) {
      console.error('Audio upload failed:', err);
      const reason = err instanceof Error && err.message ? err.message : '알 수 없는 오류';
      showToast(`음원 파일 업로드 실패: ${reason}`, 'error');
    } finally {
      setIsUploadingAudio(false);
      setUploadProgressPct(0);
    }
  };

  const handleUploadNewAudioSong = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (selectedFiles.length === 0) return;
    await processAudioFilesUpload(selectedFiles);
  };

  const handleReplaceSongAudioFile = async (
    songId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const targetLevel = selectedLevel;
    const targetLessonName = selectedLessonName;
    const targetSong = songsList.find((s) => s.id === songId);
    const oldAudioId = targetSong?.audioFile?.audioId;

    setIsUploadingAudio(true);
    setUploadProgressPct(0);
    try {
      const meta: SongAudioFileMeta = await uploadSongAudioFile(file, (pct) => {
        setUploadProgressPct(pct);
      });

      updateLessonByTarget(targetLevel, targetLessonName, (lesson) => ({
        ...lesson,
        songs: (lesson.songs || []).map((s) =>
          s.id === songId ? { ...s, audioFile: meta } : s
        ),
      }));

      if (oldAudioId && oldAudioId !== meta.audioId) {
        fetch(`/api/song-audio/${encodeURIComponent(oldAudioId)}`, { method: 'DELETE' }).catch(
          () => {}
        );
      }
      showToast(`음원 파일이 [${file.name}]으로 교체되었습니다.`);
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : '알 수 없는 오류';
      showToast(`음원 교체 실패: ${reason}`, 'error');
    } finally {
      setIsUploadingAudio(false);
      setUploadProgressPct(0);
    }
  };

  const handleStartEditSong = (song: SongMediaItem) => {
    setEditingSongId(song.id);
    setEditSongTitle(song.title);
    setEditSongUrl(song.youtubeUrl || '');
    setEditSongStart(Number(song.startTime) || 0);
    setEditSongEnd(song.endTime !== null && song.endTime !== undefined ? String(song.endTime) : '');
  };

  const handleSaveEditSong = (songId: string) => {
    const endParsed = editSongEnd.trim() === '' ? null : Math.max(0, Number(editSongEnd) || 0);
    updateCurrentLesson((lesson) => ({
      ...lesson,
      songs: (lesson.songs || []).map((s) =>
        s.id === songId
          ? {
              ...s,
              title: editSongTitle.trim() || s.title,
              youtubeUrl: s.type === 'youtube' ? editSongUrl.trim() : s.youtubeUrl,
              startTime: Math.max(0, Number(editSongStart) || 0),
              endTime: endParsed,
            }
          : s
      ),
    }));
    setEditingSongId(null);
    showToast('노래 정보가 수정되었습니다.');
  };

  const handleDeleteSong = (song: SongMediaItem) => {
    if (song.type === 'audio' && song.audioFile?.audioId) {
      fetch(`/api/song-audio/${encodeURIComponent(song.audioFile.audioId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    updateCurrentLesson((lesson) => ({
      ...lesson,
      songs: (lesson.songs || []).filter((s) => s.id !== song.id),
    }));
    showToast(`노래 [${song.title}]이 삭제되었습니다.`);
  };

  // =========================================================================
  // 3. PER-HANJA SONG LYRICS MANAGEMENT (무제한, 한자당 복수 가사 허용)
  // =========================================================================
  const systemCandidates: HanjaCandidate[] = useMemo(
    () => getLessonHanjaCandidates(state, selectedLevel, selectedLessonName),
    [state, selectedLevel, selectedLessonName]
  );

  const handleImportSystemHanjaRows = () => {
    const lessonOnly = systemCandidates.filter((c) => c.source === 'lesson');
    const sourceList = lessonOnly.length > 0 ? lessonOnly : systemCandidates.slice(0, 10);
    if (sourceList.length === 0) {
      showToast('이 과의 문제은행에 등록된 한자 정보가 없습니다. 직접 입력해 주세요.', 'error');
      return;
    }

    const existingKeys = new Set(
      hanjaLyricsList.map((h) => `${h.hanjaChar}__${h.hanjaMeaning}`)
    );
    const additions: SongHanjaLyricItem[] = [];
    sourceList.forEach((cand, idx) => {
      const key = `${cand.char}__${cand.meaning}`;
      if (!existingKeys.has(key)) {
        additions.push({
          id: `hl_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          hanjaChar: cand.char,
          hanjaMeaning: cand.meaning,
          lyricLine: '',
          order: hanjaLyricsList.length + additions.length + 1,
        });
      }
    });

    if (additions.length === 0) {
      showToast('이미 기존 과의 한자가 모두 목록에 불러와져 있습니다.');
      return;
    }

    updateCurrentLesson((lesson) => ({
      ...lesson,
      hanjaLyrics: [...(lesson.hanjaLyrics || []), ...additions],
    }));
    showToast(`기존 시스템에서 한자 ${additions.length}개를 불러왔습니다. 가사를 입력해 주세요.`);
  };

  const handleAddHanjaLyricRow = () => {
    const charVal = newHanjaChar.trim() || lookupHanjaChar(newHanjaMeaning);
    const meaningVal = newHanjaMeaning.trim();
    const lyricVal = newLyricLine.trim();

    if (!charVal && !meaningVal) {
      showToast('정답 한자 또는 음과 뜻을 입력해 주세요.', 'error');
      return;
    }
    if (!lyricVal) {
      showToast('노래 가사를 입력해 주세요.', 'error');
      return;
    }

    const newItem: SongHanjaLyricItem = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      hanjaChar: charVal,
      hanjaMeaning: meaningVal,
      lyricLine: lyricVal,
      order: hanjaLyricsList.length + 1,
    };

    updateCurrentLesson((lesson) => ({
      ...lesson,
      hanjaLyrics: [...(lesson.hanjaLyrics || []), newItem],
    }));

    setNewHanjaChar('');
    setNewHanjaMeaning('');
    setNewLyricLine('');
    playBeep(state.soundEnabled, 720, 0.05);
    showToast(`[${charVal || meaningVal}] 한자 가사가 추가되었습니다.`);
  };

  const handleStartEditLyricRow = (item: SongHanjaLyricItem) => {
    setEditingLyricId(item.id);
    setEditLyricChar(item.hanjaChar);
    setEditLyricMeaning(item.hanjaMeaning);
    setEditLyricText(item.lyricLine);
  };

  const handleSaveEditLyricRow = (id: string) => {
    const resolvedChar = editLyricChar.trim() || lookupHanjaChar(editLyricMeaning);
    updateCurrentLesson((lesson) => ({
      ...lesson,
      hanjaLyrics: (lesson.hanjaLyrics || []).map((h) =>
        h.id === id
          ? {
              ...h,
              hanjaChar: resolvedChar,
              hanjaMeaning: editLyricMeaning.trim(),
              lyricLine: editLyricText.trim(),
            }
          : h
      ),
    }));
    setEditingLyricId(null);
    showToast('한자별 가사가 수정되었습니다.');
  };

  const handleMoveLyricRow = (idx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= hanjaLyricsList.length) return;
    updateCurrentLesson((lesson) => {
      const next = [...(lesson.hanjaLyrics || [])];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return {
        ...lesson,
        hanjaLyrics: next.map((item, i) => ({ ...item, order: i + 1 })),
      };
    });
  };

  const handleDeleteLyricRow = (id: string) => {
    updateCurrentLesson((lesson) => ({
      ...lesson,
      hanjaLyrics: (lesson.hanjaLyrics || [])
        .filter((h) => h.id !== id)
        .map((item, i) => ({ ...item, order: i + 1 })),
    }));
    setSelectedLyricIds((prev) => prev.filter((x) => x !== id));
    showToast('한자별 가사가 삭제되었습니다.');
  };

  const handleToggleSelectLyricRow = (id: string) => {
    setSelectedLyricIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setConfirmBulkDeleteLyrics(false);
  };

  const handleToggleSelectAllLyrics = () => {
    if (selectedLyricIds.length === hanjaLyricsList.length && hanjaLyricsList.length > 0) {
      setSelectedLyricIds([]);
    } else {
      setSelectedLyricIds(hanjaLyricsList.map((h) => h.id));
    }
    setConfirmBulkDeleteLyrics(false);
  };

  const handleBulkDeleteLyrics = () => {
    if (selectedLyricIds.length === 0) return;
    const toDelete = new Set(selectedLyricIds);
    const count = selectedLyricIds.length;
    updateCurrentLesson((lesson) => ({
      ...lesson,
      hanjaLyrics: (lesson.hanjaLyrics || [])
        .filter((h) => !toDelete.has(h.id))
        .map((item, i) => ({ ...item, order: i + 1 })),
    }));
    setSelectedLyricIds([]);
    setConfirmBulkDeleteLyrics(false);
    showToast(`선택한 한자별 가사 ${count}개가 한 번에 삭제되었습니다.`);
  };

  // =========================================================================
  // 4. ZIP BACKUP & RESTORE HANDLERS
  // =========================================================================
  const handleExportFullZip = async () => {
    setIsBackingUpZip(true);
    try {
      const report = await exportFullBackupZip(state);
      setExportReport(report);
      showToast('전체 백업(ZIP) 파일이 생성되었습니다.');
    } catch (err) {
      console.error('Full ZIP backup failed:', err);
      showToast('ZIP 백업 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsBackingUpZip(false);
    }
  };

  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const preview = await inspectBackupFile(file);
      setRestorePreview(preview);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '백업 파일을 읽는 중 오류가 발생했습니다.',
        'error'
      );
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    setIsRestoringZip(true);
    try {
      const report = await executeBackupRestore(restorePreview, onUpdateState);
      setRestorePreview(null);
      setRestoreReport(report);
      showToast('백업 복구 및 무결성 검증이 완료되었습니다.');
    } catch (err) {
      console.error('Restore failed:', err);
      showToast('복구 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsRestoringZip(false);
    }
  };

  const previewSong = songsList.find((s) => s.id === previewSongId) || songsList[0] || null;
  const otherLevels = state.levels.filter(
    (lvl) => !(PRIMARY_SONG_LEVELS as readonly string[]).includes(lvl)
  );
  const configuredCount = Object.values(state.songNumberSlots || {}).filter(
    (s: any) => s && s.isConfigured && s.word?.trim() && s.enabled !== false
  ).length;

  return (
    <div id="screen-song-quiz" className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
          }`}
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Top Header & Sub-Tabs */}
      {viewMode !== 'student' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                한자 노래 문제 출제
              </h2>
              <p className="text-xs text-slate-500">
                급수·과별 노래와 한자별 가사를 등록하고, 1~10번 문제를 지정해 화이트보드 수업을 진행합니다.
              </p>
            </div>
          </div>

          {/* 2 Sub-tabs matching specification */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  viewMode === 'editor'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>노래 및 가사 관리</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('today')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  viewMode === 'today'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>오늘의 문제 출제 ({configuredCount})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualSave}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
              title={lastSavedLabel}
            >
              <Save className="w-3.5 h-3.5" />
              <span>저장</span>
            </button>

            <button
              type="button"
              onClick={handleExportFullZip}
              disabled={isBackingUpZip}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              title="기존 한자 데이터 + 노래 + 가사 + 1~10번 설정 + 실제 음원 파일을 ZIP 하나로 백업"
            >
              <FileArchive className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBackingUpZip ? 'ZIP 생성 중...' : '전체 백업(ZIP)'}</span>
            </button>

            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <FolderUp className="w-3.5 h-3.5 text-blue-600" />
              <span>백업 복구</span>
            </button>
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".zip,.json"
              onChange={handleSelectRestoreFile}
              className="hidden"
            />

            {onToggleFloatingTimer && (
              <button
                type="button"
                onClick={onToggleFloatingTimer}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  showFloatingTimer
                    ? 'bg-slate-800 text-white border-slate-900'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>타이머</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: 노래 및 가사 관리 (Editor)                                      */}
      {/* =================================================================== */}
      {viewMode === 'editor' && (
        <div className="space-y-5">
          {/* Step 1: 급수별·과별 노래 관리 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-900">
                1. 급수 및 과 선택 · 관리
              </div>
              {otherLevels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllLevels((v) => !v)}
                  className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  {showAllLevels ? '주요 급수(8급~5급·준5급)만 보기' : '전체 급수(준6급/4급 등) 더보기'}
                </button>
              )}
            </div>

            {/* Grade Selector Buttons (8급, 7급, 6급, 5급 prominent) */}
            <div className="flex flex-wrap gap-2">
              {(showAllLevels ? state.levels : [...PRIMARY_SONG_LEVELS]).map((lvl) => {
                const active = selectedLevel === lvl;
                const lessonCount = getManagedLessonsForLevel(state, lvl).length;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{lvl}</span>
                    <span className={`text-[11px] ${active ? 'text-emerald-300' : 'text-slate-500'}`}>
                      ({lessonCount}과)
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Unlimited Lessons Management Bar (Add, Select, Rename, Single & Bulk Delete) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600">
                  {selectedLevel} 과 목록 ({managedLessons.length}개 · 원하는 만큼 추가·수정·선택 일괄 삭제 가능)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    value={newLessonInput}
                    onChange={(e) => setNewLessonInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLesson()}
                    placeholder="새 과 이름 (예: 2과, 3과, 4과)"
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-44 sm:w-48 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLesson}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>과 추가</span>
                  </button>

                  {managedLessons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLessonSelectMode((v) => !v);
                        setSelectedLessonsToDelete([]);
                        setConfirmBulkDeleteLessons(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer whitespace-nowrap transition ${
                        lessonSelectMode
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{lessonSelectMode ? '선택 삭제 종료' : '과 선택 삭제'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRestoreSystemLessonsForLevel}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="기존 학습 시스템에 등록된 과 목록을 다시 불러옵니다"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>기존 과 불러오기</span>
                  </button>
                </div>
              </div>

              {/* Bulk Lesson Multi-Select Action Bar */}
              {lessonSelectMode && managedLessons.length > 0 && (
                <div className="bg-rose-50/80 border border-rose-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-rose-900">
                      삭제할 과를 체크하세요 ({selectedLessonsToDelete.length}/{managedLessons.length}개 선택됨)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLessonsToDelete([...managedLessons]);
                        setConfirmBulkDeleteLessons(false);
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-rose-300 text-rose-800 font-bold hover:bg-rose-100 cursor-pointer"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLessonsToDelete([]);
                        setConfirmBulkDeleteLessons(false);
                      }}
                      className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      선택 해제
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!confirmBulkDeleteLessons ? (
                      <button
                        type="button"
                        disabled={selectedLessonsToDelete.length === 0}
                        onClick={() => setConfirmBulkDeleteLessons(true)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>선택한 {selectedLessonsToDelete.length}개 과 한 번에 삭제</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs">
                        <span className="font-bold text-rose-800">
                          {selectedLessonsToDelete.length}개 과의 노래·가사를 삭제할까요?
                        </span>
                        <button
                          type="button"
                          onClick={handleBulkDeleteLessons}
                          className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDeleteLessons(false)}
                          className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-bold cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {managedLessons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                  {selectedLevel}에 등록된 과가 없습니다. 위에서 &quot;과 추가&quot; 또는 &quot;기존 과 불러오기&quot;를 눌러 과를 추가해 주세요.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {managedLessons.map((lName) => {
                    const isActive = selectedLessonName === lName;
                    const isCheckedForDelete = selectedLessonsToDelete.includes(lName);
                    const lData = state.songLessons?.[makeSongLessonId(selectedLevel, lName)];
                    const sCount = getSongMediaList(lData).length;
                    const hCount = getLessonSongHanjaLyrics(lData).length;

                    if (renamingLesson === lName) {
                      return (
                        <div
                          key={lName}
                          className="flex items-center gap-1 bg-blue-50 border border-blue-300 rounded-xl px-2 py-1"
                        >
                          <input
                            type="text"
                            value={renameLessonValue}
                            onChange={(e) => setRenameLessonValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRenameLesson(lName)}
                            autoFocus
                            className="px-2 py-1 rounded border border-blue-400 bg-white text-xs font-bold w-28"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmRenameLesson(lName)}
                            className="p-1 rounded bg-blue-600 text-white cursor-pointer"
                            title="저장"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingLesson(null)}
                            className="p-1 rounded bg-slate-200 text-slate-700 cursor-pointer"
                            title="취소"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    }

                    if (confirmDeleteLesson === lName) {
                      return (
                        <div
                          key={lName}
                          className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 rounded-xl px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-bold text-rose-800">{lName} 삭제할까요?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(lName)}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                          >
                            삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLesson(null)}
                            className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-bold cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      );
                    }

                    if (lessonSelectMode) {
                      return (
                        <label
                          key={lName}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                            isCheckedForDelete
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isCheckedForDelete}
                            onChange={() => handleToggleSelectLessonForDelete(lName)}
                            className="w-3.5 h-3.5 rounded accent-rose-600 cursor-pointer"
                          />
                          <span>{lName}</span>
                          {(sCount > 0 || hCount > 0) && (
                            <span
                              className={`text-[10px] ${
                                isCheckedForDelete ? 'text-rose-100' : 'text-slate-500'
                              }`}
                            >
                              (노래 {sCount} · 가사 {hCount})
                            </span>
                          )}
                        </label>
                      );
                    }

                    return (
                      <div
                        key={lName}
                        className={`flex items-center rounded-xl border transition ${
                          isActive
                            ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedLessonName(lName)}
                          className="px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{lName}</span>
                          {(sCount > 0 || hCount > 0) && (
                            <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
                              (노래 {sCount} · 가사 {hCount})
                            </span>
                          )}
                        </button>
                        <div className="flex items-center pr-1.5 gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingLesson(lName);
                              setRenameLessonValue(lName);
                            }}
                            className={`p-1 rounded transition cursor-pointer ${
                              isActive
                                ? 'text-blue-200 hover:text-white hover:bg-blue-600'
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                            title="과 이름 수정"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLesson(lName)}
                            className={`p-1 rounded transition cursor-pointer ${
                              isActive
                                ? 'text-blue-200 hover:text-rose-200 hover:bg-blue-600'
                                : 'text-slate-400 hover:text-rose-600'
                            }`}
                            title="과 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedLessonName ? (
            <>

          {/* Step 2: 과별 노래 등록 (유튜브 동영상 + 직접 음원 파일 여러 개 등록 가능) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  2. [{selectedLevel} {selectedLessonName}] 노래 등록 (유튜브 · 음원 파일 다중 등록)
                </h3>
                <p className="text-xs text-slate-500">
                  이 과에 유튜브 동영상이나 MP3·WAV·M4A 음악 파일을 원하는 만큼 여러 개 등록하고 재생할 수 있습니다.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 tabular-nums">
                등록된 노래: {songsList.length}곡
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 3-1. YouTube Song Registration */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Youtube className="w-4 h-4 text-rose-600" />
                  <span>유튜브 동영상 추가</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={ytTitleInput}
                    onChange={(e) => setYtTitleInput(e.target.value)}
                    placeholder="영상 제목 입력 (예: 8급 숫자 송)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={ytUrlInput}
                    onChange={(e) => setYtUrlInput(e.target.value)}
                    placeholder="유튜브 URL (예: https://www.youtube.com/watch?v=...)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-600 font-semibold">시작(초):</span>
                    <input
                      type="number"
                      min={0}
                      value={ytStartInput}
                      onChange={(e) => setYtStartInput(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-center tabular-nums"
                    />
                    <span className="text-slate-600 font-semibold">종료(초):</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="끝까지"
                      value={ytEndInput}
                      onChange={(e) => setYtEndInput(e.target.value)}
                      className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={handleAddYouTubeSong}
                      className="ml-auto px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>유튜브 추가</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3-2. Direct Audio File Upload (All Audio Formats + Chunked Large File + Drag&Drop) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingAudio(true);
                }}
                onDragLeave={() => setIsDraggingAudio(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingAudio(false);
                  if (!isUploadingAudio && e.dataTransfer?.files?.length) {
                    processAudioFilesUpload(e.dataTransfer.files);
                  }
                }}
                className={`border rounded-xl p-4 space-y-3 transition ${
                  isDraggingAudio
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Music className="w-4 h-4 text-emerald-600" />
                  <span>노래 파일 직접 업로드 (모든 음원 파일 지원)</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={audioTitleInput}
                    onChange={(e) => setAudioTitleInput(e.target.value)}
                    placeholder="노래 제목 입력 (비워두면 파일명 사용)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="w-full py-3 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition text-center">
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>
                      {isUploadingAudio
                        ? `음원 서버 저장 중... (${uploadProgressPct}%)`
                        : '음원 파일 선택 또는 끌어다 놓기 (MP3 · WAV · M4A · FLAC · AAC 등 모든 음원)'}
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleUploadNewAudioSong}
                      disabled={isUploadingAudio}
                      className="hidden"
                    />
                  </label>
                  {isUploadingAudio && (
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${uploadProgressPct}%` }}
                        className="h-full bg-emerald-600 transition-all duration-150"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    모든 형식·대용량 음원 파일이 분할 전송으로 안전하게 저장되며, 전체 ZIP 백업 시 원본이 함께 포함됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Registered Songs List & Inline Preview/Edit */}
            {songsList.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
                <div className="lg:col-span-6 space-y-2">
                  <div className="text-xs font-bold text-slate-600">등록된 노래 목록</div>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {songsList.map((song, idx) => {
                      const isPreview = previewSong?.id === song.id;
                      const isEditing = editingSongId === song.id;
                      return (
                        <div
                          key={song.id}
                          className={`p-3 space-y-2 ${isPreview ? 'bg-blue-50/40' : 'bg-white'}`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editSongTitle}
                                onChange={(e) => setEditSongTitle(e.target.value)}
                                placeholder="노래 제목"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                              />
                              {song.type === 'youtube' && (
                                <input
                                  type="text"
                                  value={editSongUrl}
                                  onChange={(e) => setEditSongUrl(e.target.value)}
                                  placeholder="유튜브 URL"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                                />
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span>시작:</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={editSongStart}
                                  onChange={(e) =>
                                    setEditSongStart(Math.max(0, Number(e.target.value) || 0))
                                  }
                                  className="w-16 px-2 py-1 rounded border border-slate-300 text-center font-mono"
                                />
                                <span>종료:</span>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="끝"
                                  value={editSongEnd}
                                  onChange={(e) => setEditSongEnd(e.target.value)}
                                  className="w-16 px-2 py-1 rounded border border-slate-300 text-center font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditSong(song.id)}
                                  className="ml-auto px-3 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSongId(null)}
                                  className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewSongId(song.id)}
                                className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
                              >
                                <span className="text-xs font-mono font-bold text-slate-400 w-5">
                                  {idx + 1}.
                                </span>
                                {song.type === 'youtube' ? (
                                  <Youtube className="w-4 h-4 text-rose-600 shrink-0" />
                                ) : (
                                  <Music className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {song.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {song.type === 'youtube'
                                      ? song.youtubeUrl
                                      : `${song.audioFile?.fileName || '음원'}`}
                                  </div>
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewSongId(song.id)}
                                  className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer flex items-center gap-1 ${
                                    isPreview
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <Play className="w-3 h-3" />
                                  <span>재생</span>
                                </button>

                                {song.type === 'audio' && (
                                  <label
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                                    title="다른 음원 파일로 교체"
                                  >
                                    교체
                                    <input
                                      type="file"
                                      onChange={(ev) => handleReplaceSongAudioFile(song.id, ev)}
                                      disabled={isUploadingAudio}
                                      className="hidden"
                                    />
                                  </label>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleStartEditSong(song)}
                                  className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                  title="제목/URL/구간 수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSong(song)}
                                  className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="text-xs font-bold text-slate-600 mb-2">선택한 노래 미리듣기</div>
                  <SongAudioPlayer media={previewSong} variant="editor" />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: 한자별 노래 가사 등록 (개수 무제한, 한자당 복수 가사 허용, 기존 한자 불러오기) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  3. [{selectedLevel} {selectedLessonName}] 한자별 노래 가사 등록 ({hanjaLyricsList.length}개)
                </h3>
                <p className="text-xs text-slate-500">
                  한자 하나마다 노래 가사를 직접 입력하며, 한자 하나에 여러 개의 가사를 등록할 수도 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleImportSystemHanjaRows}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>기존 시스템 한자 불러오기</span>
              </button>
            </div>

            {/* Quick Clickable Chips from Existing System Hanja */}
            {systemCandidates.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">
                  기존 {selectedLevel} {selectedLessonName} 한자 빠른 선택 (클릭하면 아래 입력칸에 한자·음뜻 자동 입력):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {systemCandidates.slice(0, 30).map((cand, i) => (
                    <button
                      key={`${cand.char}_${cand.meaning}_${i}`}
                      type="button"
                      onClick={() => {
                        setNewHanjaChar(cand.char);
                        setNewHanjaMeaning(cand.meaning);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-semibold text-slate-800 cursor-pointer transition"
                    >
                      <span className="font-bold mr-1">{cand.char}</span>
                      <span className="text-slate-600">{cand.meaning}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Per-Hanja Lyric Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">정답 한자</label>
                <input
                  type="text"
                  value={newHanjaChar}
                  onChange={(e) => setNewHanjaChar(e.target.value)}
                  placeholder="예: 一"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold text-center"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">음과 뜻</label>
                <input
                  type="text"
                  value={newHanjaMeaning}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewHanjaMeaning(val);
                    if (!newHanjaChar.trim()) {
                      const autoChar = lookupHanjaChar(val);
                      if (autoChar) setNewHanjaChar(autoChar);
                    }
                  }}
                  placeholder="예: 한 일"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">노래 가사</label>
                <input
                  type="text"
                  value={newLyricLine}
                  onChange={(e) => setNewLyricLine(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHanjaLyricRow()}
                  placeholder="예: 나무 막대 한 개는 한일"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleAddHanjaLyricRow}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>가사 추가</span>
                </button>
              </div>
            </div>

            {/* Per-Hanja Lyrics Table with Bulk Multi-Select Delete */}
            {hanjaLyricsList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                아직 등록된 한자별 노래 가사가 없습니다. 위 입력창에서 추가하거나 &quot;기존 시스템 한자 불러오기&quot;를 눌러 시작하세요.
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllLyrics}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                      <span>
                        {selectedLyricIds.length === hanjaLyricsList.length
                          ? '전체 선택 해제'
                          : `전체 선택 (${hanjaLyricsList.length}개)`}
                      </span>
                    </button>
                    {selectedLyricIds.length > 0 && (
                      <span className="font-bold text-rose-700">
                        {selectedLyricIds.length}개 가사 선택됨
                      </span>
                    )}
                  </div>

                  {selectedLyricIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {!confirmBulkDeleteLyrics ? (
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDeleteLyrics(true)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>선택한 {selectedLyricIds.length}개 가사 한 번에 삭제</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 rounded-lg px-2.5 py-1 text-xs">
                          <span className="font-bold text-rose-800">
                            {selectedLyricIds.length}개 가사를 삭제할까요?
                          </span>
                          <button
                            type="button"
                            onClick={handleBulkDeleteLyrics}
                            className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                          >
                            삭제 확인
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDeleteLyrics(false)}
                            className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 font-bold cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <th className="py-2.5 px-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              hanjaLyricsList.length > 0 &&
                              selectedLyricIds.length === hanjaLyricsList.length
                            }
                            onChange={handleToggleSelectAllLyrics}
                            aria-label="전체 가사 선택"
                            className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-2.5 w-12 text-center">번호</th>
                        <th className="py-2.5 px-3 w-20 text-center">한자</th>
                        <th className="py-2.5 px-3 w-36">음과 뜻</th>
                        <th className="py-2.5 px-3">노래 가사</th>
                        <th className="py-2.5 px-3 w-36 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {hanjaLyricsList.map((item, idx) => {
                        const isEditing = editingLyricId === item.id;
                        const isRowChecked = selectedLyricIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={
                              isRowChecked ? 'bg-rose-50/50' : 'hover:bg-slate-50/70'
                            }
                          >
                            <td className="py-2.5 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isRowChecked}
                                onChange={() => handleToggleSelectLyricRow(item.id)}
                                aria-label={`${idx + 1}번 가사 선택`}
                                className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-xs font-mono font-bold text-slate-400 tabular-nums">
                              {idx + 1}
                            </td>
                            {isEditing ? (
                              <>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={editLyricChar}
                                    onChange={(e) => setEditLyricChar(e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-blue-400 text-center font-bold"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={editLyricMeaning}
                                    onChange={(e) => setEditLyricMeaning(e.target.value)}
                                    className="w-full px-2 py-1 rounded border border-blue-400 text-xs font-semibold"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={editLyricText}
                                    onChange={(e) => setEditLyricText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEditLyricRow(item.id)}
                                    className="w-full px-2 py-1 rounded border border-blue-400 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditLyricRow(item.id)}
                                      className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingLyricId(null)}
                                      className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                                    >
                                      취소
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 px-3 text-center text-2xl font-black text-slate-900">
                                  {item.hanjaChar || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-xs font-bold text-slate-700">
                                  {item.hanjaMeaning}
                                </td>
                                <td className="py-2.5 px-3 text-sm font-medium text-slate-900">
                                  {item.lyricLine || (
                                    <span className="text-slate-400 italic text-xs">
                                      가사 미입력 (수정 버튼을 눌러 입력하세요)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveLyricRow(idx, 'up')}
                                      className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                                      title="위로"
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === hanjaLyricsList.length - 1}
                                      onClick={() => handleMoveLyricRow(idx, 'down')}
                                      className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                                      title="아래로"
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditLyricRow(item)}
                                      className="p-1.5 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                                      title="수정"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLyricRow(item.id)}
                                      className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                      title="삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          </>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              {selectedLevel}에서 노래 및 가사를 관리할 과를 먼저 추가하거나 불러와 주세요.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: 오늘의 문제 출제 (1~10번 번호 버튼 설정)                           */}
      {/* =================================================================== */}
      {viewMode === 'today' && (
        <SongTodayBuilder
          state={state}
          onUpdateState={onUpdateState}
          onNotify={showToast}
          onStartClass={(activeNumbers, initialSlotNumber) => {
            setStudentSession({ activeNumbers, initialSlotNumber });
            setViewMode('student');
          }}
        />
      )}

      {/* =================================================================== */}
      {/* CLASSROOM MODE: 2단 수업 화면                                          */}
      {/* =================================================================== */}
      {viewMode === 'student' && studentSession && (
        <SongStudentStage
          state={state}
          activeSlotNumbers={studentSession.activeNumbers}
          initialSlotNumber={studentSession.initialSlotNumber}
          onUpdateState={onUpdateState}
          onExit={() => setViewMode('today')}
        />
      )}

      {/* Pre-restore Confirmation Modal */}
      {restorePreview && (
        <RestoreConfirmModal
          preview={restorePreview}
          isRestoring={isRestoringZip}
          onCancel={() => setRestorePreview(null)}
          onBackupCurrentFirst={handleExportFullZip}
          onConfirmRestore={handleConfirmRestore}
        />
      )}

      {/* Post-backup / Post-restore Integrity Verification Modal */}
      {exportReport && (
        <IntegrityReportModal
          mode="export"
          exportReport={exportReport}
          onClose={() => setExportReport(null)}
        />
      )}
      {restoreReport && (
        <IntegrityReportModal
          mode="restore"
          restoreReport={restoreReport}
          onClose={() => setRestoreReport(null)}
        />
      )}
    </div>
  );
};
