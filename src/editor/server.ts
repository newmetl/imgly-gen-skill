import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import express, { type Request, type Response } from 'express';

import {
  getTemplatePaths,
  templateExists,
  updateMetadata,
} from '../storage/templateManager.js';

const DEFAULT_EDITOR_PORT = 3456;
const EDITOR_DIST_DIR = path.resolve('./editor-app/dist');
const HEALTH_PATH = '/__health';
const SHUTDOWN_TIMEOUT_MS = 5000;

let serverInstance: http.Server | null = null;
let serverUrl: string | null = null;

function buildApp(): express.Express {
  const app = express();

  // Roher ZIP-Body — kein base64, kein multipart. Limit großzügig (50 MB).
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
      res.status(404).json({ error: `Template '${id}' nicht gefunden.` });
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
        .json({ error: `Template '${id}' nicht gefunden. Zuerst setup_template aufrufen.` });
      return;
    }
    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({
        error:
          'Erwartet Content-Type "application/zip" mit Roh-Body. Kein gültiger Body empfangen.',
      });
      return;
    }
    if (
      body[0] !== 0x50 ||
      body[1] !== 0x4b ||
      body[2] !== 0x03 ||
      body[3] !== 0x04
    ) {
      res.status(400).json({ error: 'Body hat keine ZIP-Signatur.' });
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
      // Lizenz zur Laufzeit ins HTML injizieren (statt zweite .env im editor-app).
      // JSON.stringify quotet & escaped sicher (verhindert Skript-Injection).
      const inject = `<script>window.__CESDK_LICENSE__=${JSON.stringify(license)};</script>`;
      const html = indexHtml.replace('</head>', `${inject}</head>`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    };

    app.get(['/', '/index.html'], sendIndex);
    // Statische Assets (JS, CSS, Fonts ...) — index NICHT erneut über static
    // ausliefern, sonst überspringt Express den injizierenden Handler.
    app.use(express.static(EDITOR_DIST_DIR, { index: false }));
    // SPA-Fallback: alle nicht-API-Requests auf index.html (mit Inject) umlenken
    app.get(/^\/(?!api\/|__health$).*/, sendIndex);
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res
        .status(503)
        .type('text/plain')
        .send(
          'Editor-App ist noch nicht gebaut. ' +
            'Bitte einmal "npm --prefix editor-app install && npm --prefix editor-app run build" ausführen.\n' +
            `Erwarteter Pfad: ${EDITOR_DIST_DIR}`,
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
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Editor-Server wurde nicht innerhalb von ${timeoutMs}ms bereit.`);
}

export async function startEditorServer(port?: number): Promise<string> {
  if (serverUrl) return serverUrl;

  const actualPort =
    port ?? parseInt(process.env.EDITOR_PORT ?? String(DEFAULT_EDITOR_PORT), 10);
  if (!Number.isFinite(actualPort) || actualPort <= 0) {
    throw new Error(`Ungültiger Editor-Port: ${actualPort}`);
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
