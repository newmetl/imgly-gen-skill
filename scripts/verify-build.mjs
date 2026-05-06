#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(here);

const required = [
  path.join(repoRoot, 'dist', 'cli', 'index.js'),
  path.join(repoRoot, 'editor-app', 'dist', 'index.html'),
];

const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length > 0) {
  process.stderr.write('Build verification failed. Missing artifacts:\n');
  for (const p of missing) process.stderr.write(`  - ${p}\n`);
  process.stderr.write(
    'Run "npm run install:all && npm run build" from the repo root.\n',
  );
  process.exit(1);
}

process.stdout.write('Build artifacts verified.\n');
