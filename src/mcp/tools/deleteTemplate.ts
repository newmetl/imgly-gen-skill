import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  deleteTemplate,
  templateExists,
} from '../../storage/templateManager.js';
import { jsonResult, toolError } from './helpers.js';

const inputSchema = {
  templateId: z.string().min(1).describe('Die ID des zu löschenden Templates.'),
  confirm: z
    .boolean()
    .describe(
      'Sicherheitscheck. Muss explizit auf true gesetzt sein, um das Template wirklich zu löschen.',
    ),
};

export function registerDeleteTemplate(server: McpServer): void {
  server.registerTool(
    'delete_template',
    {
      title: 'Template löschen',
      description:
        'Löscht ein Template inklusive Archiv und Metadaten unwiderruflich. ' +
        'Erfordert confirm=true. Bereits gerenderte Output-Bilder bleiben erhalten.',
      inputSchema,
    },
    async (input) => {
      try {
        if (!input.confirm) {
          return toolError(
            `Löschen von '${input.templateId}' abgebrochen — confirm=true ist erforderlich.`,
          );
        }
        if (!templateExists(input.templateId)) {
          return toolError(`Template '${input.templateId}' existiert nicht.`);
        }
        deleteTemplate(input.templateId);
        return jsonResult({
          deleted: input.templateId,
          message: `Template '${input.templateId}' wurde gelöscht.`,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
