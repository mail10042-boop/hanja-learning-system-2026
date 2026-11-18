import JSZip from 'jszip';
import { AppState, SongAudioFileMeta, SongLessonData, SongNumberSlot } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { sortHanjaLevels } from './levelOrder';
import { getLessonSongHanjaLyrics, getSongMediaList } from './songHelpers';

export interface SongIntegrityStats {
  levelCount: number;
  bankRangeCount: number;
  lyricsCount: number; // lessons having lyrics / hanjaLyrics
  hanjaLyricRowCount: number; // total per-Hanja lyric entries
  questionCount: number; // configured numbered questions (1~10) + legacy questions
  configuredSlotCount: number; // 1~10 slots configured
  linkedHanjaCount: number;
  youtubeCount: number;
  audioCount: number;
  quizSetCount: number;
}

export interface BackupExportReport extends SongIntegrityStats {
  fileName: string;
  audioBackedUpCount: number;
  missingAudioFiles: string[];
  totalSizeBytes: number;
}

export interface BackupPreview {
  fileType: 'zip' | 'json';
  fileName: string;
  parsedState: AppState;
  stats: SongIntegrityStats;
  audioEntries: {
    audioId: string;
    fileName: string;
    mimeType: string;
    blob: Blob;
  }[];
  warnings: string[];
}

export interface RestoreIntegrityReport extends SongIntegrityStats {
  fileType: 'zip' | 'json';
  audioRestoredCount: number;
  audioVerifiedCount: number;
  failedAudioFiles: string[];
  warnings: string[];
  success: boolean;
}

/**
 * Collects all unique audio metadata entries across both new multi-song lists and legacy fields.
 */
function collectAllAudioMeta(state: AppState): { label: string; meta: SongAudioFileMeta }[] {
  const result: { label: string; meta: SongAudioFileMeta }[] = [];
  const seen = new Set<string>();
  const songLessons = state.songLessons ? (Object.values(state.songLessons) as SongLessonData[]) : [];

  songLessons.forEach((lesson) => {
    const mediaList = getSongMediaList(lesson);
    mediaList.forEach((m) => {
      if (m.type === 'audio' && m.audioFile?.audioId && !seen.has(m.audioFile.audioId)) {
        seen.add(m.audioFile.audioId);
        result.push({
          label: `${lesson.level} ${lesson.lessonName} (${m.title || m.audioFile.fileName})`,
          meta: m.audioFile,
        });
      }
    });
    if (lesson.audioFile?.audioId && !seen.has(lesson.audioFile.audioId)) {
      seen.add(lesson.audioFile.audioId);
      result.push({
        label: `${lesson.level} ${lesson.lessonName} - ${lesson.audioFile.fileName}`,
        meta: lesson.audioFile,
      });
    }
  });

  return result;
}

export function computeIntegrityStats(state: AppState): SongIntegrityStats {
  const levels = Array.isArray(state.levels) ? state.levels : [];
  let bankRangeCount = 0;
  if (state.bank && typeof state.bank === 'object') {
    Object.values(state.bank).forEach((ranges) => {
      if (ranges && typeof ranges === 'object') {
        bankRangeCount += Object.keys(ranges).length;
      }
    });
  }

  const songLessons = state.songLessons ? (Object.values(state.songLessons) as SongLessonData[]) : [];
  let lyricsCount = 0;
  let hanjaLyricRowCount = 0;
  let legacyQuestionCount = 0;
  let linkedHanjaCount = 0;
  let youtubeCount = 0;
  const audioIds = new Set<string>();

  songLessons.forEach((lesson: SongLessonData) => {
    const hanjaLyrics = getLessonSongHanjaLyrics(lesson);
    if (hanjaLyrics.length > 0 || (lesson.lyrics && lesson.lyrics.trim().length > 0)) {
      lyricsCount += 1;
    }
    hanjaLyricRowCount += hanjaLyrics.length;

    if (Array.isArray(lesson.questions)) {
      legacyQuestionCount += lesson.questions.length;
      lesson.questions.forEach((q) => {
        if ((q.hanjaChar && q.hanjaChar.trim()) || (q.hanjaMeaning && q.hanjaMeaning.trim())) {
          linkedHanjaCount += 1;
        }
      });
    }

    const mediaList = getSongMediaList(lesson);
    mediaList.forEach((m) => {
      if (m.type === 'youtube' && m.youtubeUrl?.trim()) youtubeCount += 1;
      if (m.type === 'audio' && m.audioFile?.audioId) audioIds.add(m.audioFile.audioId);
    });
    if (lesson.audioFile?.audioId) audioIds.add(lesson.audioFile.audioId);
  });

  const slots = state.songNumberSlots ? (Object.values(state.songNumberSlots) as SongNumberSlot[]) : [];
  const configuredSlots = slots.filter((s) => s && s.isConfigured && s.word?.trim());
  const configuredSlotCount = configuredSlots.length;
  configuredSlots.forEach((s) => {
    if ((s.hanjaChar && s.hanjaChar.trim()) || (s.hanjaMeaning && s.hanjaMeaning.trim())) {
      linkedHanjaCount += 1;
    }
  });

  const quizSetCount = Array.isArray(state.songQuizSets) ? state.songQuizSets.length : 0;

  return {
    levelCount: levels.length,
    bankRangeCount,
    lyricsCount,
    hanjaLyricRowCount,
    questionCount: configuredSlotCount > 0 ? configuredSlotCount : legacyQuestionCount,
    configuredSlotCount,
    linkedHanjaCount,
    youtubeCount,
    audioCount: audioIds.size,
    quizSetCount,
  };
}

/**
 * Exports entire AppState + all real uploaded MP3/WAV/M4A audio files into one .zip archive.
 */
export async function exportFullBackupZip(state: AppState): Promise<BackupExportReport> {
  const zip = new JSZip();
  const stats = computeIntegrityStats(state);
  const missingAudioFiles: string[] = [];
  let audioBackedUpCount = 0;

  // 1. Add complete AppState JSON
  zip.file('hanja_backup_data.json', JSON.stringify(state, null, 2));

  // 2. Fetch and embed every uploaded audio binary into audio/
  const audioFolder = zip.folder('audio');
  const audioMetaIndex: Record<string, SongAudioFileMeta & { zipPath: string }> = {};
  const allAudioEntries = collectAllAudioMeta(state);

  for (const { label, meta } of allAudioEntries) {
    try {
      const res = await fetch(`/api/song-audio/${encodeURIComponent(meta.audioId)}`);
      if (!res.ok) {
        missingAudioFiles.push(label);
        continue;
      }
      const arrayBuf = await res.arrayBuffer();
      const safeFileName = (meta.fileName || `${meta.audioId}.mp3`).replace(/[/\\?%*:|"<>]/g, '_');
      const zipEntryName = `${meta.audioId}__${safeFileName}`;
      audioFolder?.file(zipEntryName, arrayBuf);
      audioMetaIndex[meta.audioId] = {
        ...meta,
        zipPath: `audio/${zipEntryName}`,
      };
      audioBackedUpCount += 1;
    } catch (err) {
      console.warn('Audio fetch error during ZIP export:', meta.audioId, err);
      missingAudioFiles.push(label);
    }
  }

  // 3. Add integrity manifest JSON
  const manifest = {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    stats,
    audioBackedUpCount,
    missingAudioFiles,
    audioFiles: audioMetaIndex,
  };
  zip.file('backup_manifest.json', JSON.stringify(manifest, null, 2));

  // 4. Generate ZIP blob and download
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const fileName = `hanja_full_backup_${new Date().toISOString().slice(0, 10)}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1500);

  return {
    ...stats,
    fileName,
    audioBackedUpCount,
    missingAudioFiles,
    totalSizeBytes: blob.size,
  };
}

/**
 * Inspects a .zip or .json backup file WITHOUT modifying current app state,
 * returning a preview + warnings so the user can confirm before restoring.
 */
export async function inspectBackupFile(file: File): Promise<BackupPreview> {
  const lowerName = file.name.toLowerCase();
  const warnings: string[] = [];

  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);

    const dataFile =
      zip.file('hanja_backup_data.json') ||
      zip.file(/\.json$/i).find((f) => !f.name.endsWith('backup_manifest.json'));

    if (!dataFile) {
      throw new Error('ZIP 백업 파일 안에 한자 학습 데이터(hanja_backup_data.json)가 없습니다.');
    }

    const jsonText = await dataFile.async('string');
    const parsed = JSON.parse(jsonText);
    if (!parsed || (!parsed.bank && !parsed.sections && !parsed.levels)) {
      throw new Error('올바른 한자 학습 보조 시스템 백업 데이터가 아닙니다.');
    }

    let manifestAudioMap: Record<string, SongAudioFileMeta & { zipPath?: string }> = {};
    const manifestFile = zip.file('backup_manifest.json');
    if (manifestFile) {
      try {
        const manifest = JSON.parse(await manifestFile.async('string'));
        if (manifest?.audioFiles && typeof manifest.audioFiles === 'object') {
          manifestAudioMap = manifest.audioFiles;
        }
      } catch {}
    }

    const sanitized: AppState = {
      ...INITIAL_STATE,
      ...parsed,
      levels: sortHanjaLevels(parsed.levels || INITIAL_STATE.levels),
    };

    const expectedAudioMeta: Record<string, SongAudioFileMeta> = {};
    collectAllAudioMeta(sanitized).forEach(({ meta }) => {
      expectedAudioMeta[meta.audioId] = meta;
    });

    const audioEntries: BackupPreview['audioEntries'] = [];
    const foundAudioIds = new Set<string>();

    const audioFilesInZip = zip.file(/^audio\//i).filter((f) => !f.dir);
    for (const entry of audioFilesInZip) {
      const baseName = entry.name.replace(/^audio\//i, '');
      const sepIdx = baseName.indexOf('__');
      const audioId = sepIdx > 0 ? baseName.slice(0, sepIdx) : baseName.replace(/\.[^.]+$/, '');
      const originalFileName =
        expectedAudioMeta[audioId]?.fileName ||
        manifestAudioMap[audioId]?.fileName ||
        (sepIdx > 0 ? baseName.slice(sepIdx + 2) : baseName);
      const mimeType =
        expectedAudioMeta[audioId]?.mimeType ||
        manifestAudioMap[audioId]?.mimeType ||
        'audio/mpeg';

      const blob = await entry.async('blob');
      audioEntries.push({
        audioId,
        fileName: originalFileName,
        mimeType,
        blob,
      });
      foundAudioIds.add(audioId);
    }

    Object.values(expectedAudioMeta).forEach((meta) => {
      if (!foundAudioIds.has(meta.audioId)) {
        warnings.push(`음원 파일 누락: ${meta.fileName} (ZIP 내부에 실제 파일이 없습니다)`);
      }
    });

    return {
      fileType: 'zip',
      fileName: file.name,
      parsedState: sanitized,
      stats: computeIntegrityStats(sanitized),
      audioEntries,
      warnings,
    };
  } else {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || (!parsed.bank && !parsed.sections && !parsed.levels)) {
      throw new Error('올바르지 않은 백업 파일 형식입니다.');
    }

    const sanitized: AppState = {
      ...INITIAL_STATE,
      ...parsed,
      levels: sortHanjaLevels(parsed.levels || INITIAL_STATE.levels),
    };
    const stats = computeIntegrityStats(sanitized);
    if (stats.audioCount > 0) {
      warnings.push(
        `JSON 단독 백업 파일입니다. 등록된 음원(${stats.audioCount}개)의 실제 MP3/WAV/M4A 파일은 ZIP 백업 파일 복구 시 함께 복원됩니다.`
      );
    }

    return {
      fileType: 'json',
      fileName: file.name,
      parsedState: sanitized,
      stats,
      audioEntries: [],
      warnings,
    };
  }
}

/**
 * Executes confirmed backup restoration:
 * 1. Restores all audio binary files to server storage preserving audioId.
 * 2. Verifies each restored audio file is readable via HEAD request.
 * 3. Updates AppState & persists immediately to /api/state.
 */
export async function executeBackupRestore(
  preview: BackupPreview,
  onUpdateState: (updater: (prev: AppState) => AppState) => void
): Promise<RestoreIntegrityReport> {
  let audioRestoredCount = 0;
  let audioVerifiedCount = 0;
  const failedAudioFiles: string[] = [];
  const warnings = [...preview.warnings];

  for (const item of preview.audioEntries) {
    try {
      const uploadRes = await fetch(
        `/api/song-audio?audioId=${encodeURIComponent(item.audioId)}&fileName=${encodeURIComponent(
          item.fileName
        )}&mimeType=${encodeURIComponent(item.mimeType)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': item.mimeType || 'application/octet-stream' },
          body: item.blob,
        }
      );

      if (!uploadRes.ok) {
        failedAudioFiles.push(item.fileName);
        continue;
      }
      audioRestoredCount += 1;

      const verifyRes = await fetch(`/api/song-audio/${encodeURIComponent(item.audioId)}`, {
        method: 'HEAD',
      });
      if (verifyRes.ok) {
        audioVerifiedCount += 1;
      } else {
        failedAudioFiles.push(`${item.fileName} (재생 검증 실패)`);
      }
    } catch (err) {
      console.error('Failed to restore audio file:', item.fileName, err);
      failedAudioFiles.push(item.fileName);
    }
  }

  if (preview.fileType === 'json') {
    const allAudio = collectAllAudioMeta(preview.parsedState);
    for (const { meta } of allAudio) {
      try {
        const checkRes = await fetch(`/api/song-audio/${encodeURIComponent(meta.audioId)}`, {
          method: 'HEAD',
        });
        if (checkRes.ok) {
          audioVerifiedCount += 1;
        } else {
          failedAudioFiles.push(`${meta.fileName} (서버에 음원 파일 없음)`);
        }
      } catch {
        failedAudioFiles.push(meta.fileName);
      }
    }
  }

  onUpdateState(() => preview.parsedState);
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: preview.parsedState }),
    });
  } catch (err) {
    warnings.push('클라우드 서버 동기화 요청 중 일시적인 네트워크 지연이 발생했습니다.');
    console.warn('Immediate cloud save after restore failed:', err);
  }

  return {
    ...preview.stats,
    fileType: preview.fileType,
    audioRestoredCount,
    audioVerifiedCount,
    failedAudioFiles,
    warnings,
    success: failedAudioFiles.length === 0,
  };
}
