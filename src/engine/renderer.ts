import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import CreativeEngine from '@cesdk/node';

import {
  getOutputPath,
  getTemplatePaths,
  loadMetadata,
} from '../storage/templateManager.js';
import type { RenderJob, RenderResult } from '../storage/types.js';

function requireLicense(): string {
  const license = process.env.CESDK_LICENSE;
  if (!license) {
    throw new Error(
      'CESDK_LICENSE is not set. Add your img.ly license key to .env (or the environment).',
    );
  }
  return license;
}

export async function renderPost(job: RenderJob): Promise<RenderResult> {
  const meta = loadMetadata(job.templateId);

  const missing = meta.variables.filter((v) => !(v in job.variables));
  if (missing.length > 0) {
    throw new Error(
      `Missing variables for '${job.templateId}': ${missing.join(', ')}`,
    );
  }

  const absImagePath = path.resolve(job.imagePath);
  if (!fs.existsSync(absImagePath)) {
    throw new Error(`Image not found: ${absImagePath}`);
  }

  const license = requireLicense();
  const engine = await CreativeEngine.init({ license });

  try {
    const { fileUrl } = getTemplatePaths(job.templateId);
    await engine.scene.loadFromArchiveURL(fileUrl);

    for (const [key, value] of Object.entries(job.variables)) {
      engine.variable.setString(key, value);
    }

    const placeholderName = meta.placeholders[0];
    if (placeholderName != null) {
      const [imageBlock] = engine.block.findByName(placeholderName);
      if (imageBlock != null) {
        const fill = engine.block.getFill(imageBlock);
        engine.block.setString(
          fill,
          'fill/image/imageFileURI',
          pathToFileURL(absImagePath).href,
        );
      }
    }

    const [page] = engine.block.findByType('page');
    if (page == null) {
      throw new Error('Loaded template contains no page.');
    }

    const blob = await engine.block.export(page, {
      mimeType: 'image/png',
      targetWidth: meta.dimensions.width,
      targetHeight: meta.dimensions.height,
    });

    const buffer = Buffer.from(await blob.arrayBuffer());
    const outputPath = job.outputPath
      ? path.resolve(job.outputPath)
      : getOutputPath(job.templateId);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    return {
      outputPath,
      templateId: job.templateId,
      renderedAt: new Date().toISOString(),
    };
  } finally {
    engine.dispose();
  }
}
