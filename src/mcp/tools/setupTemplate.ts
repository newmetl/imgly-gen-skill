import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createBaseTemplate } from '../../engine/bootstrap.js';
import {
  loadMetadata,
  slugify,
  templateExists,
} from '../../storage/templateManager.js';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../../storage/types.js';
import { startEditorServer } from '../../editor/server.js';
import { jsonResult, toolError } from './helpers.js';

const inputSchema = {
  name: z
    .string()
    .min(1)
    .describe('Anzeigename des Templates, z. B. "Herbst-Kampagne".'),
  description: z
    .string()
    .min(1)
    .describe('Kurze Beschreibung des Verwendungszwecks.'),
  platform: z
    .enum(SOCIAL_PLATFORMS as readonly [SocialPlatform, ...SocialPlatform[]])
    .describe(
      'Ziel-Plattform. Bestimmt die Bildmaße, z. B. "instagram_square" → 1080×1080.',
    ),
  variables: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Liste der Text-Variablen-Namen. Erste Variable wird als Headline (bold) gerendert, ' +
        'weitere als Body-Text. Beispiel: ["headline", "postText"].',
    ),
};

export function registerSetupTemplate(server: McpServer): void {
  server.registerTool(
    'setup_template',
    {
      title: 'Template-Setup starten',
      description:
        'Legt ein neues Social-Media-Template an. Erzeugt ein strukturiertes Basis-Template ' +
        'per @cesdk/node (Bild-Platzhalter + Text-Variablen) und startet einen lokalen Editor-Server, ' +
        'in dem der Nutzer das visuelle Design verfeinert. Nach dem Speichern im Editor muss der Nutzer ' +
        'den Status mit "confirm_template" bestätigen, bevor "render_post" funktioniert.',
      inputSchema,
    },
    async (input) => {
      try {
        const templateId = slugify(input.name);
        if (!templateId) {
          return toolError(
            'Aus dem Namen konnte keine gültige Template-ID gebildet werden.',
          );
        }
        if (templateExists(templateId)) {
          const meta = loadMetadata(templateId);
          return toolError(
            `Template '${templateId}' existiert bereits (Status: ${meta.status}). ` +
              `Wähle einen anderen Namen oder lösche das vorhandene Template via "delete_template".`,
          );
        }

        await createBaseTemplate({
          templateId,
          name: input.name,
          description: input.description,
          platform: input.platform,
          variables: input.variables,
        });

        const editorUrl = await startEditorServer();
        const editorTemplateUrl = `${editorUrl}?template=${encodeURIComponent(templateId)}`;

        return jsonResult({
          templateId,
          editorUrl: editorTemplateUrl,
          message:
            `Basis-Template '${templateId}' wurde erstellt. Der Editor läuft auf ${editorUrl}. ` +
            `Bitte den Nutzer auffordern, ${editorTemplateUrl} im Browser zu öffnen, das Design zu finalisieren ` +
            `und im Editor zu speichern. Anschließend "confirm_template" mit der templateId aufrufen.`,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
