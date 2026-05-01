#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpServer } from './mcp/server.js';
import { stopEditorServer } from './editor/server.js';

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr ist im stdio-Transport sicher; stdout ist für MCP reserviert.
  process.stderr.write('[cesdk-social-skill] MCP-Server bereit (stdio).\n');

  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(`[cesdk-social-skill] Shutdown (${signal}) ...\n`);
    try {
      await stopEditorServer();
    } catch (err) {
      process.stderr.write(
        `[cesdk-social-skill] Fehler beim Editor-Stop: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  process.stderr.write(
    `[cesdk-social-skill] Fataler Fehler: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
