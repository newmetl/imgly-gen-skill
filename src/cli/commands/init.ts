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
      `Unknown platform '${args.platform}'. Allowed: ${SOCIAL_PLATFORMS.join(', ')}`,
    );
  }

  const variables = args.variables
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (variables.length === 0) {
    throw new Error(
      'At least one variable must be provided, e.g. --variables headline,body',
    );
  }

  const templateId = slugify(args.name);
  if (!templateId) {
    throw new Error('Could not derive a valid template ID from the name.');
  }
  if (templateExists(templateId)) {
    throw new Error(
      `Template '${templateId}' already exists. ` +
        `Choose a different name or delete it with "cesdk-social delete ${templateId} --force".`,
    );
  }

  await createBaseTemplate({
    templateId,
    name: args.name,
    description: args.description ?? '',
    platform: args.platform as SocialPlatform,
    variables,
  });

  process.stdout.write(`Template created: ${templateId}\n`);
  process.stdout.write(
    `Start the editor with: cesdk-social editor\n` +
      `Editor URL after start: http://localhost:3456?template=${encodeURIComponent(templateId)}\n`,
  );
}
