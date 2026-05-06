import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Layout assumption: this file sits one level below the repo root,
// i.e. <repo>/src/paths.ts → compiled <repo>/dist/paths.js.
// Both layouts have the same depth, so dirname-of-dirname always
// resolves to the repo root regardless of cwd.
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.dirname(here);

export const ENV_FILE = path.join(REPO_ROOT, '.env');
export const ENV_EXAMPLE_FILE = path.join(REPO_ROOT, '.env.example');
export const EDITOR_DIST_DIR = path.join(REPO_ROOT, 'editor-app', 'dist');
export const DEFAULT_TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');
export const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'output');
