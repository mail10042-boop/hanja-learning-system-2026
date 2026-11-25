import { SongAudioFileMeta } from '../types';

const DB_NAME = 'hanja_song_audio_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveLocalAudioBlob(
  file: Blob,
  fileName: string,
  mimeType: string,
  fixedAudioId?: string
): Promise<SongAudioFileMeta> {
  const db = await openAudioDB();
  const audioId =
    fixedAudioId || `local_aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const buf = await file.arrayBuffer();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ data: buf, fileName, mimeType: mimeType || 'audio/mpeg' }, audioId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save local audio'));
  });

  return {
    audioId,
    fileName,
    mimeType: mimeType || 'audio/mpeg',
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function loadLocalAudioBuffer(audioId: string): Promise<ArrayBuffer | null> {
  if (!audioId.startsWith('local_aud_')) return null;
  try {
    const db = await openAudioDB();
    const record = await new Promise<{ data: ArrayBuffer; mimeType?: string } | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(audioId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('Failed to read local audio'));
      }
    );
    return record?.data || null;
  } catch {
    return null;
  }
}

export async function loadLocalAudioBlobUrl(audioId: string): Promise<string | null> {
  if (!audioId.startsWith('local_aud_')) return null;
  const db = await openAudioDB();
  const record = await new Promise<{ data: ArrayBuffer; mimeType?: string } | null>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(audioId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to read local audio'));
    }
  );
  if (!record || !record.data) return null;
  const blob = new Blob([record.data], { type: record.mimeType || 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

export async function deleteLocalAudioBlob(audioId: string): Promise<void> {
  if (!audioId.startsWith('local_aud_')) return;
  try {
    const db = await openAudioDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(audioId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
