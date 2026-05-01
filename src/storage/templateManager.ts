import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { TemplateMetadata } from './types.js';

const TEMPLATES_DIR = path.resolve(process.env.TEMPLATES_DIR ?? './templates');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR ?? './output');

export interface TemplatePaths {
  dir: string;
  zip: string;
  meta: string;
  fileUrl: string;
}

export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}

export function getOutputDir(): string {
  return OUTPUT_DIR;
}

export function getTemplatePaths(id: string): TemplatePaths {
  const dir = path.join(TEMPLATES_DIR, id);
  const zip = path.join(dir, 'template.zip');
  return {
    dir,
    zip,
    meta: path.join(dir, 'metadata.json'),
    fileUrl: pathToFileURL(zip).href,
  };
}

export function templateExists(id: string): boolean {
  return fs.existsSync(getTemplatePaths(id).zip);
}

export function saveTemplateArchive(id: string, data: Buffer): void {
  const { dir, zip } = getTemplatePaths(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(zip, data);
}

export function readTemplateArchive(id: string): Buffer {
  const { zip } = getTemplatePaths(id);
  if (!fs.existsSync(zip)) {
    throw new Error(`Template-Archiv fehlt für '${id}': ${zip}`);
  }
  return fs.readFileSync(zip);
}

export function saveMetadata(meta: TemplateMetadata): void {
  const { dir, meta: metaPath } = getTemplatePaths(meta.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export function loadMetadata(id: string): TemplateMetadata {
  const { meta } = getTemplatePaths(id);
  if (!fs.existsSync(meta)) {
    throw new Error(`Template '${id}' nicht gefunden (${meta})`);
  }
  const raw = fs.readFileSync(meta, 'utf-8');
  return JSON.parse(raw) as TemplateMetadata;
}

export function updateMetadata(
  id: string,
  patch: Partial<Omit<TemplateMetadata, 'id' | 'createdAt'>>,
): TemplateMetadata {
  const current = loadMetadata(id);
  const next: TemplateMetadata = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  saveMetadata(next);
  return next;
}

export function listTemplates(): TemplateMetadata[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const entries = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  const templates: TemplateMetadata[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(TEMPLATES_DIR, entry.name, 'metadata.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      templates.push(loadMetadata(entry.name));
    } catch {
      // Beschädigtes Template überspringen, statt MCP-Tool zu crashen
    }
  }
  return templates;
}

export function deleteTemplate(id: string): void {
  const { dir } = getTemplatePaths(id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Template '${id}' nicht gefunden`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

export function getOutputPath(templateId: string): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(OUTPUT_DIR, `${templateId}_${ts}.png`);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
