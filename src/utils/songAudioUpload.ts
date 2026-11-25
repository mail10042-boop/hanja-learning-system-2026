import { SongAudioFileMeta } from '../types';

const DEFAULT_CHUNK_BYTES = 256 * 1024; // 256 KB raw (~341 KB base64 JSON — safely under 512KB/1MB/32MB proxy limits)
const MIN_CHUNK_BYTES = 32 * 1024;      // Adaptive fallback down to 32 KB if strict proxy returns 413
const MAX_CHUNK_RETRIES = 2;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const sliceLen = 0x4000; // 16 KB slices to prevent stack overflow
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += sliceLen) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + sliceLen)));
  }
  return btoa(parts.join(''));
}

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `서버 응답 오류 (HTTP ${res.status}): ${text.slice(0, 120)}`,
    };
  }
}

class PayloadTooLargeError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PayloadTooLargeError';
  }
}

async function uploadSingleJsonChunk(
  uploadId: string,
  chunkIndex: number,
  blobSlice: Blob
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      const buffer = await blobSlice.arrayBuffer();
      const chunkBase64 = arrayBufferToBase64(buffer);
      const res = await fetch('/api/song-audio/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          chunkIndex,
          chunkBase64,
        }),
      });

      if (res.status === 413) {
        throw new PayloadTooLargeError('HTTP 413');
      }

      const data = await parseJsonSafe(res);
      if (res.ok && data?.success) {
        return;
      }
      lastError = new Error(
        data?.error || `분할 전송 오류 (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''})`
      );
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error('네트워크 연결 오류');
    }
  }
  throw lastError || new Error('음원 분할 업로드에 실패했습니다.');
}

async function uploadWithChunkSize(
  file: File,
  safeName: string,
  rawMime: string,
  chunkSizeBytes: number,
  onProgress?: (percent: number) => void
): Promise<SongAudioFileMeta> {
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSizeBytes;
    const end = Math.min(file.size, start + chunkSizeBytes);
    const slice = file.slice(start, end);
    await uploadSingleJsonChunk(uploadId, i, slice);
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
    throw new Error(
      completeData?.error || `음원 파일 병합 실패 (HTTP ${completeRes.status})`
    );
  }

  onProgress?.(100);
  return completeData.audioFile as SongAudioFileMeta;
}

/**
 * Uploads any audio file reliably to the server via JSON base64 transport
 * (consistent with /api/state) with automatic adaptive chunk sizing (256KB -> 128KB -> 64KB -> 32KB)
 * so all proxy/firewall environments and all audio formats succeed cleanly.
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

  // Single-shot JSON upload for tiny files <= 256KB
  if (file.size <= DEFAULT_CHUNK_BYTES) {
    onProgress?.(25);
    const buffer = await file.arrayBuffer();
    const res = await fetch('/api/song-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: safeName,
        mimeType: rawMime,
        base64: arrayBufferToBase64(buffer),
      }),
    });
    if (res.status !== 413) {
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success && data?.audioFile) {
        onProgress?.(100);
        return data.audioFile as SongAudioFileMeta;
      }
      throw new Error(data?.error || `업로드 실패 (HTTP ${res.status})`);
    }
  }

  // Adaptive chunked upload (256KB -> 128KB -> 64KB -> 32KB on 413)
  let currentChunkSize = DEFAULT_CHUNK_BYTES;
  while (currentChunkSize >= MIN_CHUNK_BYTES) {
    try {
      return await uploadWithChunkSize(file, safeName, rawMime, currentChunkSize, onProgress);
    } catch (err) {
      if (err instanceof PayloadTooLargeError && currentChunkSize > MIN_CHUNK_BYTES) {
        currentChunkSize = Math.floor(currentChunkSize / 2);
        onProgress?.(0);
        continue;
      }
      throw err;
    }
  }

  throw new Error('서버 업로드 크기 제한으로 인해 음원 업로드에 실패했습니다.');
}
