import { SongAudioFileMeta } from '../types';
import { saveLocalAudioBlob } from './localAudioStore';

const DEFAULT_CHUNK_BYTES = 256 * 1024; // 256 KB raw (~341 KB base64 JSON)
const MIN_CHUNK_BYTES = 32 * 1024;      // Shrink down to 32 KB if strict proxy returns 413
const MAX_CHUNK_RETRIES = 2;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const sliceLen = 0x4000;
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

class RouteNotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RouteNotFoundError';
  }
}

async function uploadChunkToEndpoint(
  endpoint: '/api/song-audio' | '/api/song-audio/chunk',
  uploadId: string,
  chunkIndex: number,
  blobSlice: Blob
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      const buffer = await blobSlice.arrayBuffer();
      const chunkBase64 = arrayBufferToBase64(buffer);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chunk',
          uploadId,
          chunkIndex,
          chunkBase64,
        }),
      });

      if (res.status === 413) throw new PayloadTooLargeError('HTTP 413');
      if (res.status === 404) throw new RouteNotFoundError(`HTTP 404 (${endpoint})`);

      const data = await parseJsonSafe(res);
      if (res.ok && data?.success) return;

      lastError = new Error(data?.error || `분할 전송 오류 (HTTP ${res.status})`);
    } catch (err) {
      if (err instanceof PayloadTooLargeError || err instanceof RouteNotFoundError) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error('네트워크 연결 오류');
    }
  }
  throw lastError || new Error('음원 분할 업로드에 실패했습니다.');
}

async function uploadWithChunkedEndpoints(
  file: File,
  safeName: string,
  rawMime: string,
  chunkSizeBytes: number,
  chunkEndpoint: '/api/song-audio' | '/api/song-audio/chunk',
  completeEndpoint: '/api/song-audio' | '/api/song-audio/complete',
  onProgress?: (percent: number) => void
): Promise<SongAudioFileMeta> {
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSizeBytes;
    const end = Math.min(file.size, start + chunkSizeBytes);
    const slice = file.slice(start, end);
    await uploadChunkToEndpoint(chunkEndpoint, uploadId, i, slice);
    const pct = Math.min(92, Math.round(((i + 1) / totalChunks) * 92));
    onProgress?.(pct);
  }

  const completeRes = await fetch(completeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      uploadId,
      totalChunks,
      fileName: safeName,
      mimeType: rawMime,
    }),
  });
  if (completeRes.status === 404) {
    throw new RouteNotFoundError(`HTTP 404 (${completeEndpoint})`);
  }
  const completeData = await parseJsonSafe(completeRes);
  if (!completeRes.ok || !completeData?.success || !completeData?.audioFile) {
    throw new Error(completeData?.error || `음원 파일 병합 실패 (HTTP ${completeRes.status})`);
  }

  onProgress?.(100);
  return completeData.audioFile as SongAudioFileMeta;
}

/**
 * Multi-layered resilient audio uploader:
 * 1) Single-shot JSON for <= 256KB files on /api/song-audio
 * 2) Chunked JSON on /api/song-audio (action: 'chunk' / 'complete')
 * 3) Fallback chunked JSON on /api/song-audio/chunk + /api/song-audio/complete
 * 4) Fallback raw binary single-shot on /api/song-audio?fileName=...
 * 5) Final fallback to browser IndexedDB localAudioStore if all server routes return 404
 */
export async function uploadSongAudioFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<SongAudioFileMeta> {
  if (!file) throw new Error('선택된 파일이 없습니다.');
  if (file.size === 0) {
    throw new Error('파일 크기가 0바이트입니다. 올바른 음원 파일을 선택해 주세요.');
  }

  const safeName = file.name || `audio_${Date.now()}.mp3`;
  const rawMime = file.type || 'application/octet-stream';

  // 1) Tiny files <= 256KB: direct JSON base64 to /api/song-audio
  if (file.size <= DEFAULT_CHUNK_BYTES) {
    try {
      onProgress?.(30);
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
      if (res.ok) {
        const data = await parseJsonSafe(res);
        if (data?.success && data?.audioFile) {
          onProgress?.(100);
          return data.audioFile as SongAudioFileMeta;
        }
      }
      if (res.status === 404) {
        throw new RouteNotFoundError('HTTP 404 (/api/song-audio)');
      }
    } catch (err) {
      if (err instanceof RouteNotFoundError) {
        onProgress?.(50);
        const localMeta = await saveLocalAudioBlob(file, safeName, rawMime);
        onProgress?.(100);
        return localMeta;
      }
      // Otherwise fall through to chunked / raw binary fallbacks
    }
  }

  // 2) Try chunked JSON on primary /api/song-audio, then secondary /api/song-audio/chunk
  const endpointPairs: Array<{
    chunk: '/api/song-audio' | '/api/song-audio/chunk';
    complete: '/api/song-audio' | '/api/song-audio/complete';
  }> = [
    { chunk: '/api/song-audio', complete: '/api/song-audio' },
    { chunk: '/api/song-audio/chunk', complete: '/api/song-audio/complete' },
  ];

  for (const pair of endpointPairs) {
    let currentChunkSize = DEFAULT_CHUNK_BYTES;
    while (currentChunkSize >= MIN_CHUNK_BYTES) {
      try {
        return await uploadWithChunkedEndpoints(
          file,
          safeName,
          rawMime,
          currentChunkSize,
          pair.chunk,
          pair.complete,
          onProgress
        );
      } catch (err) {
        if (err instanceof PayloadTooLargeError && currentChunkSize > MIN_CHUNK_BYTES) {
          currentChunkSize = Math.floor(currentChunkSize / 2);
          onProgress?.(0);
          continue;
        }
        if (err instanceof RouteNotFoundError) {
          break; // try next endpoint pair
        }
        // Check if older server rejected JSON on /api/song-audio (expects raw binary)
        break;
      }
    }
  }

  // 3) Legacy raw binary fallback on /api/song-audio?fileName=...
  try {
    onProgress?.(35);
    const buffer = await file.arrayBuffer();
    const res = await fetch(
      `/api/song-audio?fileName=${encodeURIComponent(safeName)}&mimeType=${encodeURIComponent(rawMime)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      }
    );
    if (res.status !== 404) {
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success && data?.audioFile) {
        onProgress?.(100);
        return data.audioFile as SongAudioFileMeta;
      }
    }
  } catch {
    // Fall through to IndexedDB if backend route is unavailable
  }

  // 4) Final guaranteed fallback: IndexedDB local browser audio store (never fails with 404!)
  onProgress?.(70);
  const localMeta = await saveLocalAudioBlob(file, safeName, rawMime);
  onProgress?.(100);
  return localMeta;
}
