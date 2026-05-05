import fs from 'node:fs';
import path from 'node:path';

import { getOutputDir, slugify } from '../../storage/templateManager.js';

export interface GenerateArgs {
  prompt: string;
  output?: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

function resolveOutputPath(prompt: string, explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  const dir = path.join(getOutputDir(), 'generated');
  fs.mkdirSync(dir, { recursive: true });
  const slug = slugify(prompt) || 'image';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(dir, `${slug}_${ts}.png`);
}

function buildUrl(args: GenerateArgs): string {
  const url = new URL(`${POLLINATIONS_BASE}/${encodeURIComponent(args.prompt)}`);
  url.searchParams.set('width', String(args.width ?? 1024));
  url.searchParams.set('height', String(args.height ?? 1024));
  url.searchParams.set('nologo', 'true');
  if (args.seed !== undefined) url.searchParams.set('seed', String(args.seed));
  if (args.model) url.searchParams.set('model', args.model);
  return url.toString();
}

export async function runGenerate(args: GenerateArgs): Promise<void> {
  if (!args.prompt.trim()) {
    throw new Error('Prompt darf nicht leer sein.');
  }

  const outputPath = resolveOutputPath(args.prompt, args.output);
  const url = buildUrl(args);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Pollinations.ai antwortete mit HTTP ${response.status} ${response.statusText}.`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error('Pollinations.ai lieferte einen leeren Body.');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  process.stdout.write(`${outputPath}\n`);
}
