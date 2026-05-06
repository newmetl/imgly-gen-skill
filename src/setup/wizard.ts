import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';

import express, { type Request, type Response } from 'express';

import { ENV_FILE, ENV_EXAMPLE_FILE } from '../paths.js';

const PLACEHOLDER_VALUES = new Set(['', 'your_license_key_here']);

export interface LicenseStatus {
  hasEnvFile: boolean;
  hasLicense: boolean;
  value: string | null;
}

export function readLicenseStatus(): LicenseStatus {
  if (!fs.existsSync(ENV_FILE)) {
    return { hasEnvFile: false, hasLicense: false, value: null };
  }
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const value = parseEnvValue(text, 'CESDK_LICENSE');
  if (value === null || PLACEHOLDER_VALUES.has(value)) {
    return { hasEnvFile: true, hasLicense: false, value };
  }
  return { hasEnvFile: true, hasLicense: true, value };
}

function parseEnvValue(text: string, key: string): string | null {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (line.startsWith('#') || line === '') continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      return value.slice(1, -1);
    }
    const hashAt = value.indexOf(' #');
    if (hashAt !== -1) value = value.slice(0, hashAt).trim();
    return value;
  }
  return null;
}

export function ensureEnvFile(): void {
  if (fs.existsSync(ENV_FILE)) return;
  if (!fs.existsSync(ENV_EXAMPLE_FILE)) {
    fs.writeFileSync(ENV_FILE, 'CESDK_LICENSE=\n', 'utf8');
    return;
  }
  fs.copyFileSync(ENV_EXAMPLE_FILE, ENV_FILE);
}

export function writeLicense(license: string): void {
  ensureEnvFile();
  const original = fs.readFileSync(ENV_FILE, 'utf8');
  const lines = original.split(/\r?\n/);
  let replaced = false;
  const next = lines.map((rawLine) => {
    const trimmed = rawLine.trimStart();
    if (trimmed.startsWith('#') || trimmed === '') return rawLine;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return rawLine;
    if (trimmed.slice(0, eq).trim() !== 'CESDK_LICENSE') return rawLine;
    replaced = true;
    return `CESDK_LICENSE=${license}`;
  });
  if (!replaced) next.push(`CESDK_LICENSE=${license}`);
  fs.writeFileSync(ENV_FILE, next.join('\n'), 'utf8');
}

async function validateLicense(license: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  // CE.SDK validates against api.img.ly during CreativeEngine.init().
  // An invalid key throws synchronously or asynchronously.
  const cesdk = await import('@cesdk/node');
  const CreativeEngine = cesdk.default;
  let engine: Awaited<ReturnType<typeof CreativeEngine.init>> | null = null;
  try {
    engine = await CreativeEngine.init({ license });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    engine?.dispose();
  }
}

async function findFreePort(start: number, attempts = 20): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const port = start + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port available in range ${start}-${start + attempts - 1}.`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}

const WIZARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Set up CE.SDK license</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      color: #e8e8e8;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #222;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { line-height: 1.55; color: #c9c9c9; }
    a { color: #93c5fd; }
    label { display: block; margin-top: 18px; font-size: 13px; color: #b8b8b8; }
    input[type="password"], input[type="text"] {
      width: 100%;
      margin-top: 6px;
      padding: 12px 14px;
      font-size: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #111;
      color: #e8e8e8;
      border: 1px solid #444;
      border-radius: 6px;
    }
    input:focus { outline: 2px solid #3b82f6; outline-offset: -1px; }
    .row { display: flex; gap: 10px; margin-top: 18px; align-items: center; }
    button {
      padding: 11px 20px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      background: #3b82f6;
      color: white;
      cursor: pointer;
    }
    button:disabled { background: #444; cursor: not-allowed; }
    .toggle {
      background: transparent;
      color: #9ca3af;
      font-weight: 400;
      padding: 8px 10px;
      border: 1px solid #444;
    }
    .status { margin-top: 16px; min-height: 22px; font-size: 13px; }
    .status.error { color: #fca5a5; }
    .status.success { color: #86efac; }
    .status.info { color: #93c5fd; }
    .done { text-align: center; }
    .done h1 { color: #86efac; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <h1>Set up CE.SDK license</h1>
    <p>
      Enter your <strong>CE.SDK license key</strong> below. You can get a free trial key at
      <a href="https://img.ly/dashboard" target="_blank" rel="noopener">img.ly/dashboard</a>.
      The key is validated against img.ly and then stored locally in <code>.env</code> —
      it never leaves your machine.
    </p>
    <form id="form" autocomplete="off">
      <label for="license">License key</label>
      <input id="license" name="license" type="password" required spellcheck="false"
             placeholder="ey…" />
      <div class="row">
        <button type="submit" id="submit">Save &amp; validate</button>
        <button type="button" class="toggle" id="toggle">Show</button>
      </div>
      <div class="status" id="status"></div>
    </form>
  </div>
  <script>
    const form = document.getElementById('form');
    const input = document.getElementById('license');
    const submit = document.getElementById('submit');
    const toggle = document.getElementById('toggle');
    const status = document.getElementById('status');
    const card = document.getElementById('card');

    toggle.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      toggle.textContent = isPwd ? 'Hide' : 'Show';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const license = input.value.trim();
      if (!license) return;
      submit.disabled = true;
      status.className = 'status info';
      status.textContent = 'Validating against api.img.ly … (5–10 s)';
      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          status.className = 'status error';
          status.textContent = data.error || ('Error (HTTP ' + res.status + ')');
          submit.disabled = false;
          return;
        }
        card.innerHTML = '<div class="done"><h1>Done.</h1>' +
          '<p>The license key was validated and saved to <code>.env</code>.</p>' +
          '<p>You can close this window and return to Claude.</p></div>';
      } catch (err) {
        status.className = 'status error';
        status.textContent = 'Network error: ' + (err && err.message ? err.message : err);
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>`;

export interface WizardResult {
  saved: boolean;
}

export async function runLicenseWizard(options: { port?: number } = {}): Promise<WizardResult> {
  const status = readLicenseStatus();
  if (status.hasLicense) {
    process.stdout.write('License is already set in .env. Skipping wizard.\n');
    return { saved: false };
  }

  ensureEnvFile();

  const port = await findFreePort(options.port ?? 3458);
  const url = `http://localhost:${port}/set-license`;

  const app = express();
  app.use(express.json({ limit: '64kb' }));

  let savedResolve: (() => void) | null = null;
  const saved = new Promise<void>((resolve) => {
    savedResolve = resolve;
  });

  app.get('/set-license', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(WIZARD_HTML);
  });

  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/set-license');
  });

  app.post('/save', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { license?: unknown };
    const license = typeof body.license === 'string' ? body.license.trim() : '';
    if (!license) {
      res.status(400).json({ ok: false, error: 'License key is empty.' });
      return;
    }
    if (PLACEHOLDER_VALUES.has(license)) {
      res.status(400).json({ ok: false, error: 'Please enter a real license key.' });
      return;
    }
    const result = await validateLicense(license);
    if (!result.ok) {
      res.status(400).json({
        ok: false,
        error: `Validation failed: ${result.reason}`,
      });
      return;
    }
    try {
      writeLicense(license);
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: `Could not write .env: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    res.json({ ok: true });
    setTimeout(() => savedResolve?.(), 200);
  });

  const server: http.Server = await new Promise((resolve, reject) => {
    const s = app.listen(port, '127.0.0.1');
    s.once('listening', () => resolve(s));
    s.once('error', reject);
  });

  process.stdout.write(`License wizard running: ${url}\n`);
  process.stdout.write('Open in your browser, enter your license key, and save.\n');
  process.stdout.write('(The wizard exits automatically after a successful save.)\n');

  await saved;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  return { saved: true };
}
