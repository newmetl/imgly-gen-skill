import CreativeEngine from '@cesdk/node';

import {
  DEFAULT_IMAGE_PLACEHOLDER_NAME,
  PLATFORM_DIMENSIONS,
  type SocialPlatform,
} from '../storage/types.js';
import { saveMetadata, saveTemplateArchive } from '../storage/templateManager.js';

const ROBOTO_BOLD =
  'https://cdn.img.ly/packages/imgly/cesdk-js/latest/assets/extensions/ly.img.cesdk.fonts/fonts/Roboto/Roboto-Bold.ttf';
const ROBOTO_REGULAR =
  'https://cdn.img.ly/packages/imgly/cesdk-js/latest/assets/extensions/ly.img.cesdk.fonts/fonts/Roboto/Roboto-Regular.ttf';

const PADDING = 40;

export interface BootstrapConfig {
  templateId: string;
  name: string;
  description: string;
  platform: SocialPlatform;
  variables: string[];
  imagePlaceholderName?: string;
}

function requireLicense(): string {
  const license = process.env.CESDK_LICENSE;
  if (!license) {
    throw new Error(
      'CESDK_LICENSE ist nicht gesetzt. Bitte in .env (oder ENV) den img.ly Lizenzschlüssel hinterlegen.',
    );
  }
  return license;
}

export async function createBaseTemplate(config: BootstrapConfig): Promise<void> {
  if (config.variables.length === 0) {
    throw new Error('Mindestens eine Variable muss angegeben werden.');
  }

  const license = requireLicense();
  const placeholderName = config.imagePlaceholderName ?? DEFAULT_IMAGE_PLACEHOLDER_NAME;
  const { width, height } = PLATFORM_DIMENSIONS[config.platform];
  const contentWidth = width - PADDING * 2;
  const imageHeight = Math.round(height * 0.6);

  const engine = await CreativeEngine.init({ license });

  try {
    engine.scene.create('Free', { page: { size: { width, height } } });
    engine.scene.setDesignUnit('Pixel');

    const [page] = engine.block.findByType('page');
    if (page == null) {
      throw new Error('Konnte Page-Block nach scene.create nicht finden.');
    }

    // --- Bild-Platzhalter (oben, ~60% der Höhe) ---
    const imageBlock = engine.block.create('graphic');
    engine.block.setShape(imageBlock, engine.block.createShape('rect'));
    const imageFill = engine.block.createFill('image');
    engine.block.setFill(imageBlock, imageFill);
    engine.block.setName(imageBlock, placeholderName);
    engine.block.setWidth(imageBlock, width);
    engine.block.setHeight(imageBlock, imageHeight);
    engine.block.setPositionX(imageBlock, 0);
    engine.block.setPositionY(imageBlock, 0);
    engine.block.setPlaceholderEnabled(imageBlock, true);
    if (engine.block.supportsPlaceholderBehavior(imageFill)) {
      engine.block.setPlaceholderBehaviorEnabled(imageFill, true);
    }
    engine.block.setPlaceholderControlsOverlayEnabled(imageBlock, true);
    engine.block.setPlaceholderControlsButtonEnabled(imageBlock, true);
    engine.block.appendChild(page, imageBlock);

    // --- Text-Blöcke je Variable ---
    const textAreaTop = imageHeight + PADDING;
    const textAreaHeight = height - textAreaTop - PADDING;
    const blockHeight = Math.max(
      40,
      Math.floor(textAreaHeight / config.variables.length),
    );

    config.variables.forEach((varName, index) => {
      const isHeadline = index === 0;
      const fontUri = isHeadline ? ROBOTO_BOLD : ROBOTO_REGULAR;
      const subFamily = isHeadline ? 'Bold' : 'Regular';
      const weight = isHeadline ? 'bold' : 'normal';

      const textBlock = engine.block.create('text');
      engine.block.replaceText(textBlock, `{{${varName}}}`);
      engine.block.setFont(textBlock, fontUri, {
        name: 'Roboto',
        fonts: [{ uri: fontUri, subFamily, weight }],
      });
      engine.block.setFloat(
        textBlock,
        'text/fontSize',
        isHeadline ? 28 : 16,
      );
      engine.block.setWidthMode(textBlock, 'Absolute');
      engine.block.setHeightMode(textBlock, 'Auto');
      engine.block.setWidth(textBlock, contentWidth);
      engine.block.setPositionX(textBlock, PADDING);
      engine.block.setPositionY(textBlock, textAreaTop + index * blockHeight);
      engine.block.setEnum(textBlock, 'text/horizontalAlignment', 'Left');
      engine.block.appendChild(page, textBlock);

      engine.variable.setString(varName, `[${varName}]`);
    });

    // --- Constraints: Layout sperren, Bildtausch erlauben ---
    engine.editor.setGlobalScope('layer/move', 'Defer');
    engine.editor.setGlobalScope('layer/resize', 'Defer');
    engine.block.setScopeEnabled(imageBlock, 'layer/move', false);
    engine.block.setScopeEnabled(imageBlock, 'layer/resize', false);
    engine.block.setScopeEnabled(imageBlock, 'fill/change', true);

    // --- Archiv speichern ---
    const archive = await engine.scene.saveToArchive();
    const buffer = Buffer.from(await archive.arrayBuffer());
    saveTemplateArchive(config.templateId, buffer);

    const now = new Date().toISOString();
    saveMetadata({
      id: config.templateId,
      name: config.name,
      description: config.description,
      platform: config.platform,
      dimensions: { width, height },
      variables: [...config.variables],
      placeholders: [placeholderName],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  } finally {
    engine.dispose();
  }
}
