import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'song_audio');
const STATE_FILE_PATH = path.join(DATA_DIR, 'hanja_cloud_state.json');

// Ensure data storage directories exist
for (const dir of [DATA_DIR, AUDIO_DIR]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err);
    }
  }
}

// Helper to sanitize audioId against path traversal
function sanitizeAudioId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

// Track connected SSE clients for instant broadcast to all devices/browsers
type SSEClient = {
  id: string;
  res: express.Response;
};
let sseClients: SSEClient[] = [];
let lastStateVersion = Date.now();

function broadcastStateUpdate(senderClientId?: string) {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return;
    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const payload = JSON.stringify({
      type: 'STATE_UPDATED',
      version: lastStateVersion,
      state: parsed,
      senderClientId: senderClientId || null,
    });

    sseClients.forEach((client) => {
      // Don't echo back full state unnecessarily to the same client if not needed,
      // but let client handle it with version / client-id check
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.error(`Failed to write to client ${client.id}:`, err);
      }
    });
  } catch (error) {
    console.error('Failed to broadcast state update:', error);
  }
}

async function startServer() {
  const app = express();

  // Parse JSON bodies up to 20MB (for large lyrics & quiz datasets)
  app.use(express.json({ limit: '20mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), clientsCount: sseClients.length });
  });

  // =========================================================================
  // SONG AUDIO BINARY STORAGE ENDPOINTS (MP3, WAV, M4A, etc.)
  // =========================================================================

  // List all stored audio file metadata
  app.get('/api/song-audio', (req, res) => {
    try {
      const files = fs.readdirSync(AUDIO_DIR);
      const list = files
        .filter((f) => f.endsWith('.meta.json'))
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, f), 'utf-8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return res.json({ success: true, files: list });
    } catch (error) {
      console.error('Error listing audio files:', error);
      return res.status(500).json({ success: false, error: 'Failed to list audio files' });
    }
  });

  // Upload or restore an audio file (raw binary body up to 100MB)
  app.post(
    '/api/song-audio',
    express.raw({ type: '*/*', limit: '100mb' }),
    (req, res) => {
      try {
        const buffer = req.body as Buffer;
        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
          return res.status(400).json({ success: false, error: 'Empty audio file payload' });
        }

        const rawFileName = typeof req.query.fileName === 'string' ? req.query.fileName : 'audio.mp3';
        let decodedFileName = rawFileName;
        try {
          decodedFileName = decodeURIComponent(rawFileName);
        } catch {
          decodedFileName = rawFileName;
        }

        const mimeType =
          (typeof req.query.mimeType === 'string' && req.query.mimeType) ||
          req.headers['content-type'] ||
          'audio/mpeg';

        const requestedId =
          typeof req.query.audioId === 'string' ? sanitizeAudioId(req.query.audioId) : '';
        const audioId =
          requestedId || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const binPath = path.join(AUDIO_DIR, `${audioId}.bin`);
        const metaPath = path.join(AUDIO_DIR, `${audioId}.meta.json`);

        const meta = {
          audioId,
          fileName: decodedFileName,
          mimeType,
          size: buffer.length,
          uploadedAt: new Date().toISOString(),
        };

        fs.writeFileSync(binPath, buffer);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        return res.json({ success: true, audioFile: meta });
      } catch (error) {
        console.error('Error saving audio file:', error);
        return res.status(500).json({ success: false, error: 'Failed to save audio file' });
      }
    }
  );

  // Check audio file existence (HEAD) for integrity verification
  app.head('/api/song-audio/:audioId', (req, res) => {
    const audioId = sanitizeAudioId(req.params.audioId || '');
    if (!audioId) return res.status(400).end();
    const binPath = path.join(AUDIO_DIR, `${audioId}.bin`);
    if (!fs.existsSync(binPath)) return res.status(404).end();
    const stat = fs.statSync(binPath);
    res.setHeader('Content-Length', String(stat.size));
    return res.status(200).end();
  });

  // Stream / download audio file with HTTP Range (206) support for smooth seeking & speed control
  app.get('/api/song-audio/:audioId', (req, res) => {
    try {
      const audioId = sanitizeAudioId(req.params.audioId || '');
      if (!audioId) {
        return res.status(400).json({ success: false, error: 'Invalid audioId' });
      }
      const binPath = path.join(AUDIO_DIR, `${audioId}.bin`);
      const metaPath = path.join(AUDIO_DIR, `${audioId}.meta.json`);

      if (!fs.existsSync(binPath)) {
        return res.status(404).json({ success: false, error: 'Audio file not found' });
      }

      let mimeType = 'audio/mpeg';
      let fileName = `${audioId}.mp3`;
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta.mimeType) mimeType = meta.mimeType;
          if (meta.fileName) fileName = meta.fileName;
        } catch {}
      }

      // Infer MIME from extension if generic octet-stream
      if (mimeType === 'application/octet-stream' || !mimeType.startsWith('audio/')) {
        const ext = path.extname(fileName).toLowerCase();
        if (ext === '.wav') mimeType = 'audio/wav';
        else if (ext === '.m4a') mimeType = 'audio/mp4';
        else if (ext === '.ogg') mimeType = 'audio/ogg';
        else mimeType = 'audio/mpeg';
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(binPath);
    } catch (error) {
      console.error('Error streaming audio file:', error);
      return res.status(500).json({ success: false, error: 'Failed to stream audio file' });
    }
  });

  // Delete an audio file
  app.delete('/api/song-audio/:audioId', (req, res) => {
    try {
      const audioId = sanitizeAudioId(req.params.audioId || '');
      if (!audioId) {
        return res.status(400).json({ success: false, error: 'Invalid audioId' });
      }
      const binPath = path.join(AUDIO_DIR, `${audioId}.bin`);
      const metaPath = path.join(AUDIO_DIR, `${audioId}.meta.json`);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting audio file:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete audio file' });
    }
  });

  // GET Cloud State: Returns persistent server-stored state & version
  app.get('/api/state', (req, res) => {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return res.json({ success: true, state: parsed, exists: true, version: lastStateVersion, timestamp: Date.now() });
      }
      return res.json({ success: true, state: null, exists: false, version: lastStateVersion });
    } catch (error) {
      console.error('Error reading cloud state:', error);
      return res.status(500).json({ success: false, error: 'Failed to read server state' });
    }
  });

  // Real-time Server-Sent Events (SSE) stream for instant push sync across iPad, Galaxy Tab, PC, Mac
  app.get('/api/state/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newClient: SSEClient = { id: clientId, res };
    sseClients.push(newClient);

    // Initial handshake message with current version & clientId
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, version: lastStateVersion })}\n\n`);

    // Keep connection alive with heartbeat comment every 25s
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAliveInterval);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAliveInterval);
      sseClients = sseClients.filter((c) => c.id !== clientId);
    });
  });

  // POST Cloud State: Saves state across all devices and broadcasts to connected devices
  app.post('/api/state', (req, res) => {
    try {
      const { state, clientId } = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid state payload' });
      }

      lastStateVersion = Date.now();

      // Write atomically to temporary file first, then rename
      const tempPath = `${STATE_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tempPath, STATE_FILE_PATH);

      // Broadcast update instantly to iPad, Samsung tablets, PC, laptop, phone
      broadcastStateUpdate(clientId);

      return res.json({ success: true, version: lastStateVersion, timestamp: Date.now() });
    } catch (error) {
      console.error('Error saving cloud state:', error);
      return res.status(500).json({ success: false, error: 'Failed to persist state to server' });
    }
  });

  // POST Reset Cloud State
  app.post('/api/state/reset', (req, res) => {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        fs.unlinkSync(STATE_FILE_PATH);
      }
      lastStateVersion = Date.now();
      broadcastStateUpdate();
      return res.json({ success: true, message: 'Server state reset to default' });
    } catch (error) {
      console.error('Error resetting cloud state:', error);
      return res.status(500).json({ success: false, error: 'Failed to reset state' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hanja Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
