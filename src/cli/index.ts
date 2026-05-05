#!/usr/bin/env node
import 'dotenv/config';
import { parseArgs } from 'node:util';

import { runInit } from './commands/init.js';
import { runEditor } from './commands/editor.js';
import { runRender } from './commands/render.js';
import { runList } from './commands/list.js';
import { runDelete } from './commands/delete.js';
import { runGenerate } from './commands/generate.js';
import { runWizard } from './commands/wizard.js';

const HELP = `cesdk-social — CE.SDK Social-Media Template-Generator

Befehle:
  cesdk-social wizard [--port <port>]
      Startet den lokalen Lizenz-Wizard im Browser; validiert und speichert
      den CE.SDK License Key in .env. Beendet sich automatisch nach Save.

  cesdk-social init <name> --platform <p> --variables <a,b,c> [--description <d>]
      Legt ein neues Template (Draft) an.

  cesdk-social editor [--port <port>]
      Startet den lokalen Browser-Editor (Foreground, Ctrl+C zum Stoppen).

  cesdk-social render <id> --image <pfad> (--vars <json> | --vars-file <pfad>) [--output <pfad>]
      Rendert einen Post als PNG; gibt den Output-Pfad auf stdout aus.

  cesdk-social generate "<prompt>" [--output <pfad>] [--width <n>] [--height <n>] [--seed <n>] [--model <name>]
      Generiert ein Bild über pollinations.ai; gibt den Output-Pfad auf stdout aus.

  cesdk-social list [--json]
      Listet alle Templates.

  cesdk-social delete <id> --force
      Löscht ein Template.

Plattformen:
  facebook, instagram_square, instagram_story, instagram_landscape, linkedin, twitter

Beispiele:
  cesdk-social init "Herbst-Kampagne" --platform instagram_square --variables headline,body
  cesdk-social editor
  cesdk-social render herbst-kampagne --image ~/foto.jpg \\
    --vars '{"headline":"Apfelernte","body":"Frisch vom Hof."}'
  cesdk-social generate "herbstliche Apfelernte, Korb voller roter Aepfel"
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(HELP);
    return;
  }

  switch (cmd) {
    case 'wizard': {
      const { values } = parseArgs({
        args: rest,
        options: {
          port: { type: 'string' },
        },
      });
      let port: number | undefined;
      if (values.port !== undefined) {
        port = parseInt(values.port, 10);
        if (!Number.isFinite(port) || port <= 0) {
          throw new Error(`--port muss eine positive Zahl sein, nicht '${values.port}'.`);
        }
      }
      await runWizard({ port });
      break;
    }

    case 'init': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          platform: { type: 'string' },
          variables: { type: 'string' },
          description: { type: 'string' },
        },
      });
      const name = positionals[0];
      if (!name) throw new Error('Argument <name> fehlt.');
      if (!values.platform) throw new Error('--platform ist erforderlich.');
      if (!values.variables) throw new Error('--variables ist erforderlich.');
      await runInit({
        name,
        platform: values.platform,
        variables: values.variables,
        description: values.description,
      });
      break;
    }

    case 'editor': {
      const { values } = parseArgs({
        args: rest,
        options: {
          port: { type: 'string' },
        },
      });
      let port: number | undefined;
      if (values.port !== undefined) {
        port = parseInt(values.port, 10);
        if (!Number.isFinite(port) || port <= 0) {
          throw new Error(`--port muss eine positive Zahl sein, nicht '${values.port}'.`);
        }
      }
      await runEditor(port);
      break;
    }

    case 'render': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          image: { type: 'string' },
          vars: { type: 'string' },
          'vars-file': { type: 'string' },
          output: { type: 'string' },
        },
      });
      const id = positionals[0];
      if (!id) throw new Error('Argument <id> fehlt.');
      if (!values.image) throw new Error('--image ist erforderlich.');
      await runRender({
        templateId: id,
        image: values.image,
        vars: values.vars,
        varsFile: values['vars-file'],
        output: values.output,
      });
      break;
    }

    case 'generate': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          output: { type: 'string' },
          width: { type: 'string' },
          height: { type: 'string' },
          seed: { type: 'string' },
          model: { type: 'string' },
        },
      });
      const prompt = positionals.join(' ').trim();
      if (!prompt) throw new Error('Argument <prompt> fehlt.');
      const parseDim = (raw: string | undefined, name: string): number | undefined => {
        if (raw === undefined) return undefined;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--${name} muss eine positive Zahl sein, nicht '${raw}'.`);
        }
        return n;
      };
      await runGenerate({
        prompt,
        output: values.output,
        width: parseDim(values.width, 'width'),
        height: parseDim(values.height, 'height'),
        seed: parseDim(values.seed, 'seed'),
        model: values.model,
      });
      break;
    }

    case 'list': {
      const { values } = parseArgs({
        args: rest,
        options: {
          json: { type: 'boolean' },
        },
      });
      runList(values.json ?? false);
      break;
    }

    case 'delete': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          force: { type: 'boolean' },
        },
      });
      const id = positionals[0];
      if (!id) throw new Error('Argument <id> fehlt.');
      runDelete(id, values.force ?? false);
      break;
    }

    default:
      process.stderr.write(`Unbekannter Befehl: ${cmd}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Fehler: ${err instanceof Error ? err.message : String(err)}\n`);
  if (process.env.DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
