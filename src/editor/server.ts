import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import express, { type Request, type Response } from 'express';

import { EDITOR_DIST_DIR } from '../paths.js';
import {
  getTemplatePaths,
  templateExists,
  updateMetadata,
} from '../storage/templateManager.js';

const DEFAULT_EDITOR_PORT = 3456;
const HEALTH_PATH = '/__health';
const SHUTDOWN_TIMEOUT_MS = 5000;

let serverInstance: http.Server | null = null;
let serverUrl: string | null = null;

function buildApp(): express.Express {
  const app = express();

  // Raw ZIP body — no base64, no multipart. Generous 50 MB limit.
  app.use(
    '/api/template/:id',
    express.raw({ type: 'application/zip', limit: '50mb' }),
  );

  app.get(HEALTH_PATH, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  const idOf = (req: Request): string => {
    const raw = req.params.id;
    return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  };

  app.get('/api/template/:id', (req: Request, res: Response) => {
    const id = idOf(req);
    if (!id || !templateExists(id)) {
      res.status(404).json({ error: `Template '${id}' not found.` });
      return;
    }
    const { zip } = getTemplatePaths(id);
    res.setHeader('Content-Type', 'application/zip');
    res.sendFile(zip);
  });

  app.post('/api/template/:id', (req: Request, res: Response) => {
    const id = idOf(req);
    if (!id || !templateExists(id)) {
      res
        .status(404)
        .json({ error: `Template '${id}' not found. Run init first.` });
      return;
    }
    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({
        error:
          'Expected Content-Type "application/zip" with raw body. No valid body received.',
      });
      return;
    }
    if (
      body[0] !== 0x50 ||
      body[1] !== 0x4b ||
      body[2] !== 0x03 ||
      body[3] !== 0x04
    ) {
      res.status(400).json({ error: 'Body does not have a ZIP signature.' });
      return;
    }
    const { zip } = getTemplatePaths(id);
    fs.writeFileSync(zip, body);
    updateMetadata(id, {});
    res.json({ ok: true, size: body.length });
  });

  if (fs.existsSync(EDITOR_DIST_DIR)) {
    const indexPath = path.join(EDITOR_DIST_DIR, 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    const sendIndex = (_req: Request, res: Response): void => {
      const license = process.env.CESDK_LICENSE ?? '';
      // Inject the license into the HTML at runtime (avoids a second .env in editor-app).
      // JSON.stringify quotes & escapes safely (prevents script injection).
      const inject = `<script>window.__CESDK_LICENSE__=${JSON.stringify(license)};</script>`;
      const html = indexHtml.replace('</head>', `${inject}</head>`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    };

    app.get(['/', '/index.html'], sendIndex);
    // Static assets (JS, CSS, fonts ...) — do NOT re-serve index via static,
    // otherwise Express skips the injecting handler.
    app.use(express.static(EDITOR_DIST_DIR, { index: false }));
    // SPA fallback: route all non-API requests to index.html (with inject).
    app.get(/^\/(?!api\/|__health$).*/, sendIndex);
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res
        .status(503)
        .type('text/plain')
        .send(
          'Editor app is not built yet. ' +
            'Please run "npm --prefix editor-app install && npm --prefix editor-app run build" once.\n' +
            `Expected path: ${EDITOR_DIST_DIR}`,
        );
    });
  }

  return app;
}

async function waitForHealth(url: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}${HEALTH_PATH}`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Editor server did not become ready within ${timeoutMs}ms.`);
}

export async function startEditorServer(port?: number): Promise<string> {
  if (serverUrl) return serverUrl;

  const actualPort =
    port ?? parseInt(process.env.EDITOR_PORT ?? String(DEFAULT_EDITOR_PORT), 10);
  if (!Number.isFinite(actualPort) || actualPort <= 0) {
    throw new Error(`Invalid editor port: ${actualPort}`);
  }

  const app = buildApp();
  const url = `http://localhost:${actualPort}`;

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(actualPort);
    server.once('listening', () => {
      serverInstance = server;
      resolve();
    });
    server.once('error', (err) => {
      reject(err);
    });
  });

  await waitForHealth(url);
  serverUrl = url;
  return url;
}

export async function stopEditorServer(): Promise<void> {
  if (!serverInstance) return;
  const server = serverInstance;
  serverInstance = null;
  serverUrl = null;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      server.closeAllConnections?.();
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    server.close(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
