import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { createBaseTemplate } from '../src/engine/bootstrap.js';
import {
  getTemplatePaths,
  loadMetadata,
  templateExists,
} from '../src/storage/templateManager.js';

const TEMPLATE_ID = 'smoketest-instagram-square';

async function main(): Promise<void> {
  if (templateExists(TEMPLATE_ID)) {
    const { dir } = getTemplatePaths(TEMPLATE_ID);
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`[smoketest] Vorheriges Template entfernt: ${dir}\n`);
  }

  process.stderr.write('[smoketest] Erstelle Basis-Template ...\n');
  await createBaseTemplate({
    templateId: TEMPLATE_ID,
    name: 'Smoketest Instagram Square',
    description: 'Generiert vom Smoketest-Skript zur Validierung des Bootstraps.',
    platform: 'instagram_square',
    variables: ['headline', 'postText'],
  });

  const { zip, meta, fileUrl } = getTemplatePaths(TEMPLATE_ID);
  const stats = fs.statSync(zip);
  const metadata = loadMetadata(TEMPLATE_ID);

  process.stderr.write('\n[smoketest] Erfolg.\n');
  process.stderr.write(`  Template-ID:   ${metadata.id}\n`);
  process.stderr.write(`  Plattform:     ${metadata.platform}\n`);
  process.stderr.write(
    `  Dimensionen:   ${metadata.dimensions.width}x${metadata.dimensions.height}\n`,
  );
  process.stderr.write(`  Variablen:     ${metadata.variables.join(', ')}\n`);
  process.stderr.write(`  Platzhalter:   ${metadata.placeholders.join(', ')}\n`);
  process.stderr.write(`  Status:        ${metadata.status}\n`);
  process.stderr.write(`  Archiv-Größe:  ${stats.size} bytes\n`);
  process.stderr.write(`  Archiv-Pfad:   ${zip}\n`);
  process.stderr.write(`  Archiv-URL:    ${fileUrl}\n`);
  process.stderr.write(`  Metadaten:     ${meta}\n`);

  // Sanity-Check: ZIP signature 'PK\x03\x04'
  const head = fs.readFileSync(zip).subarray(0, 4);
  const looksLikeZip =
    head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!looksLikeZip) {
    throw new Error('Archiv hat keine ZIP-Signatur — vermutlich beschädigt.');
  }
  process.stderr.write('  ZIP-Signatur:  OK\n');

  process.stderr.write(
    `\n[smoketest] Tip: Archiv inspizieren mit:\n  unzip -l ${path.relative(process.cwd(), zip)}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`\n[smoketest] Fehler: ${err instanceof Error ? err.message : String(err)}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
