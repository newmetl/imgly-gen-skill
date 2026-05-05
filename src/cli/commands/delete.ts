import { deleteTemplate, templateExists } from '../../storage/templateManager.js';

export function runDelete(templateId: string, force: boolean): void {
  if (!templateExists(templateId)) {
    throw new Error(`Template '${templateId}' existiert nicht.`);
  }
  if (!force) {
    throw new Error(
      `Löschen abgebrochen — bitte --force anhängen, um '${templateId}' wirklich zu löschen.`,
    );
  }
  deleteTemplate(templateId);
  process.stdout.write(`Template '${templateId}' gelöscht.\n`);
}
