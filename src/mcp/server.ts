import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerSetupTemplate } from './tools/setupTemplate.js';
import { registerConfirmTemplate } from './tools/confirmTemplate.js';
import { registerListTemplates } from './tools/listTemplates.js';
import { registerRenderPost } from './tools/renderPost.js';
import { registerDeleteTemplate } from './tools/deleteTemplate.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'cesdk-social-skill',
    version: '0.1.0',
  });

  registerSetupTemplate(server);
  registerConfirmTemplate(server);
  registerListTemplates(server);
  registerRenderPost(server);
  registerDeleteTemplate(server);

  return server;
}
