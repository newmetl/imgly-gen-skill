#!/usr/bin/env node
import { config as loadDotenv } from 'dotenv';
import { parseArgs } from 'node:util';

import { ENV_FILE } from '../paths.js';
loadDotenv({ path: ENV_FILE });

import { runInit } from './commands/init.js';
import { runEditor } from './commands/editor.js';
import { runRender } from './commands/render.js';
import { runList } from './commands/list.js';
import { runDelete } from './commands/delete.js';
import { runGenerate } from './commands/generate.js';
import { runWizard } from './commands/wizard.js';

const HELP = `cesdk-social — CE.SDK social media template generator

Commands:
  cesdk-social wizard [--port <port>]
      Starts the local license wizard in the browser; validates and stores
      the CE.SDK license key in .env. Exits automatically after save.

  cesdk-social init <name> --platform <p> --variables <a,b,c> [--description <d>]
      Creates a new template (draft).

  cesdk-social editor [--port <port>]
      Starts the local browser editor (foreground; Ctrl+C to stop).

  cesdk-social render <id> --image <path> (--vars <json> | --vars-file <path>) [--output <path>]
      Renders a post as PNG; prints the output path to stdout.

  cesdk-social generate "<prompt>" [--output <path>] [--width <n>] [--height <n>] [--seed <n>] [--model <name>]
      Generates an image via pollinations.ai; prints the output path to stdout.

  cesdk-social list [--json]
      Lists all templates.

  cesdk-social delete <id> --force
      Deletes a template.

Platforms:
  facebook, instagram_square, instagram_story, instagram_landscape, linkedin, twitter

Examples:
  cesdk-social init "Autumn Campaign" --platform instagram_square --variables headline,body
  cesdk-social editor
  cesdk-social render autumn-campaign --image ~/photo.jpg \\
    --vars '{"headline":"Apple Harvest","body":"Fresh from the farm."}'
  cesdk-social generate "autumnal apple harvest, basket full of red apples"
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
          throw new Error(`--port must be a positive number, not '${values.port}'.`);
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
      if (!name) throw new Error('Missing argument <name>.');
      if (!values.platform) throw new Error('--platform is required.');
      if (!values.variables) throw new Error('--variables is required.');
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
          throw new Error(`--port must be a positive number, not '${values.port}'.`);
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
      if (!id) throw new Error('Missing argument <id>.');
      if (!values.image) throw new Error('--image is required.');
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
      if (!prompt) throw new Error('Missing argument <prompt>.');
      const parseDim = (raw: string | undefined, name: string): number | undefined => {
        if (raw === undefined) return undefined;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--${name} must be a positive number, not '${raw}'.`);
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
      if (!id) throw new Error('Missing argument <id>.');
      runDelete(id, values.force ?? false);
      break;
    }

    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  if (process.env.DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
