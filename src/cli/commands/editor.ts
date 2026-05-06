import { startEditorServer, stopEditorServer } from '../../editor/server.js';

export async function runEditor(port?: number): Promise<void> {
  const url = await startEditorServer(port);
  process.stdout.write(`Editor running at ${url}\n`);
  process.stdout.write(`Open with a template ID: ${url}?template=<id>\n`);
  process.stdout.write(`Stop with Ctrl+C.\n`);

  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(`\nEditor server stopping (${signal}) ...\n`);
    try {
      await stopEditorServer();
    } catch (err) {
      process.stderr.write(
        `Error while stopping: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Hold the foreground until a signal arrives.
  await new Promise<void>(() => {
    /* never resolves */
  });
}
