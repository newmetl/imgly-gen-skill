import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import CreativeEngine from '@cesdk/node';

const THUMBNAIL_TARGET_WIDTH = 480;

function requireLicense(): string {
  const license = process.env.CESDK_LICENSE;
  if (!license) {
    throw new Error(
      'CESDK_LICENSE is not set. Add your img.ly license key to .env (or the environment).',
    );
  }
  return license;
}

export async function renderThumbnail(
  zipPath: string,
  outPath: string,
): Promise<void> {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Template archive missing: ${zipPath}`);
  }

  const license = requireLicense();
  const engine = await CreativeEngine.init({ license });

  try {
    await engine.scene.loadFromArchiveURL(pathToFileURL(zipPath).href);

    const [page] = engine.block.findByType('page');
    if (page == null) {
      throw new Error('Loaded template contains no page.');
    }

    const blob = await engine.block.export(page, {
      mimeType: 'image/png',
      targetWidth: THUMBNAIL_TARGET_WIDTH,
    });
    const buffer = Buffer.from(await blob.arrayBuffer());

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
  } finally {
    engine.dispose();
  }
}
