import { createBaseTemplate } from '../../engine/bootstrap.js';
import { slugify, templateExists } from '../../storage/templateManager.js';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../../storage/types.js';

export interface InitArgs {
  name: string;
  platform: string;
  variables: string;
  description?: string;
}

export async function runInit(args: InitArgs): Promise<void> {
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(args.platform)) {
    throw new Error(
      `Unbekannte Plattform '${args.platform}'. Erlaubt: ${SOCIAL_PLATFORMS.join(', ')}`,
    );
  }

  const variables = args.variables
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (variables.length === 0) {
    throw new Error(
      'Mindestens eine Variable muss angegeben werden, z. B. --variables headline,body',
    );
  }

  const templateId = slugify(args.name);
  if (!templateId) {
    throw new Error('Aus dem Namen konnte keine gültige Template-ID gebildet werden.');
  }
  if (templateExists(templateId)) {
    throw new Error(
      `Template '${templateId}' existiert bereits. ` +
        `Anderen Namen wählen oder mit "cesdk-social delete ${templateId} --force" löschen.`,
    );
  }

  await createBaseTemplate({
    templateId,
    name: args.name,
    description: args.description ?? '',
    platform: args.platform as SocialPlatform,
    variables,
  });

  process.stdout.write(`Template angelegt: ${templateId}\n`);
  process.stdout.write(
    `Editor starten mit: cesdk-social editor\n` +
      `Editor-URL nach Start:  http://localhost:3456?template=${encodeURIComponent(templateId)}\n`,
  );
}
