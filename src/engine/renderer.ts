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
      'CESDK_LICENSE ist nicht gesetzt. Bitte in .env (oder ENV) den img.ly Lizenzschlüssel hinterlegen.',
    );
  }
  return license;
}

export async function renderPost(job: RenderJob): Promise<RenderResult> {
  const meta = loadMetadata(job.templateId);

  if (meta.status !== 'ready') {
    throw new Error(
      `Template '${job.templateId}' hat Status '${meta.status}'. ` +
        `Bitte zuerst im Editor speichern und 'confirm_template' aufrufen.`,
    );
  }

  const missing = meta.variables.filter((v) => !(v in job.variables));
  if (missing.length > 0) {
    throw new Error(
      `Fehlende Variablen für '${job.templateId}': ${missing.join(', ')}`,
    );
  }

  const absImagePath = path.resolve(job.imagePath);
  if (!fs.existsSync(absImagePath)) {
    throw new Error(`Bild nicht gefunden: ${absImagePath}`);
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
      throw new Error('Geladenes Template enthält keine Page.');
    }

    const blob = await engine.block.export(page, {
      mimeType: 'image/png',
      targetWidth: meta.dimensions.width,
      targetHeight: meta.dimensions.height,
    });

    const buffer = Buffer.from(await blob.arrayBuffer());
    const outputPath = getOutputPath(job.templateId);
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
