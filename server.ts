import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HttpError,
  scanChapterPages,
  scanIndexPages,
  type ScanIndexInput,
  type ScanPagesInput,
} from './server/scanner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT =
  process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT) || 3000
    : 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/scan-index', async (req, res) => {
    try {
      const result = await scanIndexPages((req.body || {}) as ScanIndexInput);
      res.json(result);
    } catch (error) {
      console.error('Error in /api/scan-index:', error);
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to extract chapters from index page.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/scan-pages', async (req, res) => {
    try {
      const result = await scanChapterPages((req.body || {}) as ScanPagesInput);
      res.json(result);
    } catch (error) {
      console.error('Error in /api/scan-pages:', error);
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to scan textbook pages.';
      res.status(500).json({ error: message });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
