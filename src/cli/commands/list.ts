import { listTemplates } from '../../storage/templateManager.js';

export function runList(json: boolean): void {
  const templates = listTemplates();
  if (json) {
    process.stdout.write(JSON.stringify(templates, null, 2) + '\n');
    return;
  }
  if (templates.length === 0) {
    process.stdout.write('No templates available.\n');
    return;
  }
  for (const t of templates) {
    process.stdout.write(
      `${t.id}  [${t.platform}, ${t.dimensions.width}x${t.dimensions.height}]  vars: ${t.variables.join(', ')}\n`,
    );
  }
}
