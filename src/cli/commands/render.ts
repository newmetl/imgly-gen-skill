import fs from 'node:fs';

import { renderPost } from '../../engine/renderer.js';

export interface RenderArgs {
  templateId: string;
  image: string;
  vars?: string;
  varsFile?: string;
  output?: string;
}

function parseVariables(args: RenderArgs): Record<string, string> {
  if (args.vars && args.varsFile) {
    throw new Error('Bitte nur eines von --vars oder --vars-file angeben.');
  }
  let raw: string;
  let source: string;
  if (args.vars) {
    raw = args.vars;
    source = '--vars';
  } else if (args.varsFile) {
    raw = fs.readFileSync(args.varsFile, 'utf-8');
    source = `--vars-file ${args.varsFile}`;
  } else {
    throw new Error('Entweder --vars <json> oder --vars-file <pfad> angeben.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Konnte ${source} nicht als JSON parsen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} muss ein JSON-Objekt sein, z. B. {"headline":"…"}.`);
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new Error(`Wert für '${key}' in ${source} ist kein String.`);
    }
    result[key] = value;
  }
  return result;
}

export async function runRender(args: RenderArgs): Promise<void> {
  const variables = parseVariables(args);
  const result = await renderPost({
    templateId: args.templateId,
    variables,
    imagePath: args.image,
    outputPath: args.output,
  });
  process.stdout.write(`${result.outputPath}\n`);
}
