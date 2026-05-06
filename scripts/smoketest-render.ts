import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import { ENV_FILE, REPO_ROOT } from '../src/paths.js';
loadDotenv({ path: ENV_FILE });

import { createBaseTemplate } from '../src/engine/bootstrap.js';
import { renderPost } from '../src/engine/renderer.js';
import {
  getTemplatePaths,
  templateExists,
} from '../src/storage/templateManager.js';

const TEMPLATE_ID = 'smoketest-render';
const TEST_IMAGE_PATH = path.join(REPO_ROOT, '.cache', 'smoketest-image.jpg');
const TEST_IMAGE_URL = 'https://picsum.photos/seed/cesdk-smoketest/1080/1080';

async function ensureTestImage(): Promise<void> {
  if (fs.existsSync(TEST_IMAGE_PATH)) return;
  process.stderr.write(`[smoketest-render] Fetching test image from ${TEST_IMAGE_URL} ...\n`);
  const res = await fetch(TEST_IMAGE_URL);
  if (!res.ok) {
    throw new Error(
      `Could not load test image (HTTP ${res.status}). ` +
        'Set IMAGE_PATH as ENV or first CLI argument instead.',
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
    throw new Error(`Image not found: ${imagePath}`);
  }

  if (templateExists(TEMPLATE_ID)) {
    const { dir } = getTemplatePaths(TEMPLATE_ID);
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`[smoketest-render] Removed previous template: ${dir}\n`);
  }

  process.stderr.write('[smoketest-render] Creating base template ...\n');
  await createBaseTemplate({
    templateId: TEMPLATE_ID,
    name: 'Smoketest Render',
    description: 'Synthetic template for end-to-end render test.',
    platform: 'instagram_square',
    variables: ['headline', 'postText'],
  });

  process.stderr.write('[smoketest-render] Rendering ...\n');
  const result = await renderPost({
    templateId: TEMPLATE_ID,
    variables: {
      headline: 'Hello World',
      postText: 'This post was generated fully automatically.',
    },
    imagePath,
  });

  const stats = fs.statSync(result.outputPath);
  process.stderr.write('\n[smoketest-render] Success.\n');
  process.stderr.write(`  Output:        ${result.outputPath}\n`);
  process.stderr.write(`  Size:          ${stats.size} bytes\n`);
  process.stderr.write(`  Source image:  ${imagePath}\n`);
  process.stderr.write(`  Rendered at:   ${result.renderedAt}\n`);

  // Sanity check: PNG signature '\x89PNG\r\n\x1a\n'
  const head = fs.readFileSync(result.outputPath).subarray(0, 8);
  const isPng =
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47;
  if (!isPng) {
    throw new Error('Output has no PNG signature — likely corrupted.');
  }
  process.stderr.write('  PNG signature: OK\n');
}

main().catch((err) => {
  process.stderr.write(
    `\n[smoketest-render] Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
