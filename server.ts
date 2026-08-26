import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE_PATH = path.join(DATA_DIR, 'hanja_cloud_state.json');

// Ensure data storage directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

async function startServer() {
  const app = express();

  // Parse JSON bodies up to 10MB
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // GET Cloud State: Returns persistent server-stored state
  app.get('/api/state', (req, res) => {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return res.json({ success: true, state: parsed, exists: true, timestamp: Date.now() });
      }
      return res.json({ success: true, state: null, exists: false });
    } catch (error) {
      console.error('Error reading cloud state:', error);
      return res.status(500).json({ success: false, error: 'Failed to read server state' });
    }
  });

  // POST Cloud State: Saves state across all devices and sessions
  app.post('/api/state', (req, res) => {
    try {
      const { state } = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid state payload' });
      }

      // Write atomically to temporary file first, then rename
      const tempPath = `${STATE_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tempPath, STATE_FILE_PATH);

      return res.json({ success: true, timestamp: Date.now() });
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
