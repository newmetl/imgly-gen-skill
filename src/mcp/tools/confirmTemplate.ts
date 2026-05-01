import { z } from 'zod';
import CreativeEngine from '@cesdk/node';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  getTemplatePaths,
  loadMetadata,
  templateExists,
  updateMetadata,
} from '../../storage/templateManager.js';
import { jsonResult, toolError } from './helpers.js';

const inputSchema = {
  templateId: z
    .string()
    .min(1)
    .describe('Die Template-ID, die "setup_template" zurückgegeben hat.'),
};

export function registerConfirmTemplate(server: McpServer): void {
  server.registerTool(
    'confirm_template',
    {
      title: 'Template bestätigen',
      description:
        'Bestätigt, dass der Nutzer das Template im Editor finalisiert und gespeichert hat. ' +
        'Validiert das Archiv, liest tatsächlich enthaltene Variablen und Platzhalter aus und ' +
        'setzt den Status auf "ready". Erst danach kann das Template via "render_post" verwendet werden.',
      inputSchema,
    },
    async (input) => {
      try {
        if (!templateExists(input.templateId)) {
          return toolError(
            `Template '${input.templateId}' nicht gefunden. Zuerst "setup_template" ausführen.`,
          );
        }

        const license = process.env.CESDK_LICENSE;
        if (!license) {
          return toolError(
            'CESDK_LICENSE ist nicht gesetzt. Bitte in .env hinterlegen und MCP-Server neu starten.',
          );
        }

        const engine = await CreativeEngine.init({ license });
        let detectedVariables: string[];
        let placeholderCount: number;
        try {
          const { fileUrl } = getTemplatePaths(input.templateId);
          await engine.scene.loadFromArchiveURL(fileUrl);
          detectedVariables = engine.variable.findAll();
          placeholderCount = engine.block.findAllPlaceholders().length;
        } finally {
          engine.dispose();
        }

        const meta = loadMetadata(input.templateId);
        const updated = updateMetadata(input.templateId, {
          status: 'ready',
          variables: detectedVariables.length > 0 ? detectedVariables : meta.variables,
        });

        return jsonResult({
          templateId: updated.id,
          variables: updated.variables,
          placeholderCount,
          status: updated.status,
          message:
            `Template '${updated.id}' ist jetzt einsatzbereit. ` +
            `Erkannte Variablen: ${updated.variables.join(', ') || '(keine)'}.`,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
