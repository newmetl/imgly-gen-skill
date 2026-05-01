import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function jsonResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function toolError(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: 'text', text: `Fehler: ${message}` }],
  };
}
