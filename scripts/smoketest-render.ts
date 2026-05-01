import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { createBaseTemplate } from '../src/engine/bootstrap.js';
import { renderPost } from '../src/engine/renderer.js';
import {
  getTemplatePaths,
  templateExists,
  updateMetadata,
} from '../src/storage/templateManager.js';

const TEMPLATE_ID = 'smoketest-render';
const TEST_IMAGE_PATH = path.resolve('./.cache/smoketest-image.jpg');
const TEST_IMAGE_URL = 'https://picsum.photos/seed/cesdk-smoketest/1080/1080';

async function ensureTestImage(): Promise<void> {
  if (fs.existsSync(TEST_IMAGE_PATH)) return;
  process.stderr.write(`[smoketest-render] Lade Test-Bild von ${TEST_IMAGE_URL} ...\n`);
  const res = await fetch(TEST_IMAGE_URL);
  if (!res.ok) {
    throw new Error(
      `Konnte Test-Bild nicht laden (HTTP ${res.status}). ` +
        'Setze stattdessen IMAGE_PATH als ENV oder erstes CLI-Argument.',
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(TEST_IMAGE_PATH), { recursive: true });
  fs.writeFileSync(TEST_IMAGE_PATH, buf);
}

async function main(): Promise<void> {
  const cliImage = process.argv[2];
  const envImage = process.env.IMAGE_PATH;
  const imagePath = cliImage ?? envImage ?? TEST_IMAGE_PATH;

  if (imagePath === TEST_IMAGE_PATH) {
    await ensureTestImage();
  } else if (!fs.existsSync(imagePath)) {
    throw new Error(`Bild nicht gefunden: ${imagePath}`);
  }

  if (templateExists(TEMPLATE_ID)) {
    const { dir } = getTemplatePaths(TEMPLATE_ID);
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`[smoketest-render] Vorheriges Template entfernt: ${dir}\n`);
  }

  process.stderr.write('[smoketest-render] Erstelle Basis-Template ...\n');
  await createBaseTemplate({
    templateId: TEMPLATE_ID,
    name: 'Smoketest Render',
    description: 'Synthetisches Template für End-to-End-Render-Test.',
    platform: 'instagram_square',
    variables: ['headline', 'postText'],
  });

  // Template als ready markieren – im echten Flow macht das der Editor + confirm_template.
  updateMetadata(TEMPLATE_ID, { status: 'ready' });

  process.stderr.write('[smoketest-render] Rendere ...\n');
  const result = await renderPost({
    templateId: TEMPLATE_ID,
    variables: {
      headline: 'Hallo Welt',
      postText: 'Dieser Post wurde vollständig automatisiert generiert.',
    },
    imagePath,
  });

  const stats = fs.statSync(result.outputPath);
  process.stderr.write('\n[smoketest-render] Erfolg.\n');
  process.stderr.write(`  Output:        ${result.outputPath}\n`);
  process.stderr.write(`  Größe:         ${stats.size} bytes\n`);
  process.stderr.write(`  Quellbild:     ${imagePath}\n`);
  process.stderr.write(`  Gerendert um:  ${result.renderedAt}\n`);

  // Sanity-Check: PNG-Signatur '\x89PNG\r\n\x1a\n'
  const head = fs.readFileSync(result.outputPath).subarray(0, 8);
  const isPng =
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47;
  if (!isPng) {
    throw new Error('Output hat keine PNG-Signatur — vermutlich beschädigt.');
  }
  process.stderr.write('  PNG-Signatur:  OK\n');
}

main().catch((err) => {
  process.stderr.write(
    `\n[smoketest-render] Fehler: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
