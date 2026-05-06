import { deleteTemplate, templateExists } from '../../storage/templateManager.js';

export function runDelete(templateId: string, force: boolean): void {
  if (!templateExists(templateId)) {
    throw new Error(`Template '${templateId}' does not exist.`);
  }
  if (!force) {
    throw new Error(
      `Delete aborted — pass --force to actually delete '${templateId}'.`,
    );
  }
  deleteTemplate(templateId);
  process.stdout.write(`Template '${templateId}' deleted.\n`);
}
