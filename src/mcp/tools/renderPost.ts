import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { renderPost } from '../../engine/renderer.js';
import { listTemplates } from '../../storage/templateManager.js';
import { jsonResult, toolError } from './helpers.js';

const inputSchema = {
  templateId: z
    .string()
    .min(1)
    .describe('Die ID eines mit "confirm_template" bestätigten Templates.'),
  variables: z
    .record(z.string(), z.string())
    .describe(
      'Zuordnung Variablen-Name → Text. Muss alle Variablen aus dem Template enthalten. ' +
        'Beispiel: { "headline": "Schwarzer Freitag", "postText": "30 % auf alles." }',
    ),
  imagePath: z
    .string()
    .min(1)
    .describe(
      'Absoluter Pfad zu einer lokalen Bilddatei (PNG/JPG), die in den Bild-Platzhalter gelegt wird.',
    ),
};

export function registerRenderPost(server: McpServer): void {
  server.registerTool(
    'render_post',
    {
      title: 'Post rendern',
      description:
        'Rendert einen Social-Media-Post: lädt das Template, befüllt Text-Variablen, setzt das Bild ' +
        'in den Platzhalter und exportiert das Ergebnis als PNG. Liefert den absoluten Output-Pfad zurück.',
      inputSchema,
    },
    async (input) => {
      try {
        const result = await renderPost({
          templateId: input.templateId,
          variables: input.variables,
          imagePath: input.imagePath,
        });
        return jsonResult({
          ...result,
          message: `Post gerendert: ${result.outputPath}`,
        });
      } catch (err) {
        // Zusätzliche Hilfe wenn Template-ID falsch
        if (err instanceof Error && err.message.includes('nicht gefunden')) {
          const available = listTemplates().map((t) => t.id);
          return toolError(
            `${err.message}${available.length > 0 ? `\nVerfügbare Template-IDs: ${available.join(', ')}` : ''}`,
          );
        }
        return toolError(err);
      }
    },
  );
}
