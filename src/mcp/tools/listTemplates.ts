import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { listTemplates } from '../../storage/templateManager.js';
import { jsonResult, toolError } from './helpers.js';

export function registerListTemplates(server: McpServer): void {
  server.registerTool(
    'list_templates',
    {
      title: 'Templates auflisten',
      description:
        'Listet alle bekannten Social-Media-Templates inkl. Status, Plattform und Variablen auf. ' +
        'Nützlich, um vor "render_post" die korrekte templateId zu wählen.',
      inputSchema: {},
    },
    async () => {
      try {
        const templates = listTemplates();
        return jsonResult({
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            platform: t.platform,
            dimensions: t.dimensions,
            variables: t.variables,
            status: t.status,
            updatedAt: t.updatedAt,
          })),
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
