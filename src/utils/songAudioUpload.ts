import { SongAudioFileMeta } from '../types';

const CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per chunk (well below Cloud Run 32 MB request limit)
const MAX_CHUNK_RETRIES = 2;

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `서버 응답 오류 (HTTP ${res.status})`,
    };
  }
}

async function uploadChunkWithRetry(
  uploadId: string,
  chunkIndex: number,
  blobSlice: Blob
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      const buffer = await blobSlice.arrayBuffer();
      const res = await fetch(
        `/api/song-audio/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer,
        }
      );
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success) {
        return;
      }
      lastError = new Error(data?.error || `청크 업로드 실패 (HTTP ${res.status})`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('네트워크 오류');
    }
  }
  throw lastError || new Error('음원 분할 업로드에 실패했습니다.');
}

/**
 * Uploads any audio file reliably to the server.
 * Uses fast single-shot upload for files <= 2MB (with chunk fallback),
 * and automatic 2MB chunked upload + retry for larger files so Cloud Run
 * proxy limits never reject large WAV/MP3/M4A/FLAC files.
 */
export async function uploadSongAudioFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<SongAudioFileMeta> {
  if (!file) {
    throw new Error('선택된 파일이 없습니다.');
  }
  if (file.size === 0) {
    throw new Error('파일 크기가 0바이트입니다. 올바른 음원 파일을 선택해 주세요.');
  }

  const safeName = file.name || `audio_${Date.now()}.mp3`;
  const rawMime = file.type || 'application/octet-stream';

  // Fast single-shot path for files <= 2MB
  if (file.size <= CHUNK_SIZE_BYTES) {
    onProgress?.(20);
    const buffer = await file.arrayBuffer();
    const res = await fetch(
      `/api/song-audio?fileName=${encodeURIComponent(safeName)}&mimeType=${encodeURIComponent(
        rawMime
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      }
    );
    const data = await parseJsonSafe(res);
    if (res.ok && data?.success && data?.audioFile) {
      onProgress?.(100);
      return data.audioFile as SongAudioFileMeta;
    }
    throw new Error(data?.error || `업로드 실패 (HTTP ${res.status})`);
  }

  // Chunked upload path for files > 2MB (unlimited size up to server disk)
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + CHUNK_SIZE_BYTES);
    const slice = file.slice(start, end);
    await uploadChunkWithRetry(uploadId, i, slice);
    const pct = Math.min(92, Math.round(((i + 1) / totalChunks) * 92));
    onProgress?.(pct);
  }

  const completeRes = await fetch('/api/song-audio/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      totalChunks,
      fileName: safeName,
      mimeType: rawMime,
    }),
  });
  const completeData = await parseJsonSafe(completeRes);
  if (!completeRes.ok || !completeData?.success || !completeData?.audioFile) {
    throw new Error(completeData?.error || `음원 파일 병합 실패 (HTTP ${completeRes.status})`);
  }

  onProgress?.(100);
  return completeData.audioFile as SongAudioFileMeta;
}
