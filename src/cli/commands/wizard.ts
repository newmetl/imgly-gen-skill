import { runLicenseWizard } from '../../setup/wizard.js';

export interface WizardArgs {
  port?: number;
}

export async function runWizard(args: WizardArgs): Promise<void> {
  await runLicenseWizard({ port: args.port });
}
