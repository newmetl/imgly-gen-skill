import { startEditorServer, stopEditorServer } from '../../editor/server.js';

export async function runEditor(port?: number): Promise<void> {
  const url = await startEditorServer(port);
  process.stdout.write(`Editor läuft unter ${url}\n`);
  process.stdout.write(`Mit Template-ID öffnen: ${url}?template=<id>\n`);
  process.stdout.write(`Stoppen mit Ctrl+C.\n`);

  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(`\nEditor-Server stoppt (${signal}) ...\n`);
    try {
      await stopEditorServer();
    } catch (err) {
      process.stderr.write(
        `Fehler beim Stoppen: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Foreground halten, bis ein Signal kommt.
  await new Promise<void>(() => {
    /* never resolves */
  });
}
