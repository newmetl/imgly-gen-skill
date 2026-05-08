# imgly-gen-skill

CLI + Claude Code skill for generating social media images with
[CE.SDK](https://img.ly/products/creative-sdk) by img.ly.

The workflow: you design a template once in the local browser editor, then fill it
again and again with different texts and images — either manually via the CLI
or through Claude Code, which operates the CLI for you.

## How do I use this?

Two ways:

1. **[With Claude Code (recommended)](#1-install-via-claude-code)** — one sentence, Claude does the rest.
2. **[Manually via the CLI](#2-manual-install--usage)** — no AI tool required.

## Requirements

- Node.js >= 18 (tested with 24)
- A valid CE.SDK license key — get a free trial key at
  [img.ly/dashboard](https://img.ly/dashboard).

---

## 1. Install via Claude Code

In any terminal where you'd like the skill installed, `cd` into the parent
directory you want to clone into, start Claude Code, and tell it:

> **"Clone and set up the CE.SDK social-skill project from
> `https://github.com/newmetl/imgly-gen-skill` — fetch the README of that
> repo and follow the section *Claude Code: install runbook* exactly."**

Claude will then run the steps below. You then:

1. open the wizard URL Claude prints (e.g. `http://localhost:3458/set-license`),
2. paste your CE.SDK license key,
3. click **Save & validate** — the wizard checks the key against `api.img.ly`
   and writes it into the local `.env`,
4. tell Claude "done".

After that, Claude is ready to operate the skill and will typically ask:
*"Skill is installed. Where would you like to start — should I create an
example template, or do you already have a concept in mind?"*

> **Note:** the skill is currently installed locally (only available when Claude is
> started from the cloned directory). Global install is planned.

### Claude Code: install runbook

If you are an AI assistant invoked with "install / set up this repo", the
phrase **does not** mean "download the SKILL.md and place it under
`~/.claude/skills/`". This project requires a full clone — the skill operates
the built CLI (`dist/cli/index.js`), the editor server, and the
`@cesdk/node` engine. Without those, the skill is non-functional.

> **Running in a container?** If you are an agent inside OpenClaw or
> another container/sandbox where the user's browser cannot reach
> container-loopback ports, follow [docs/OPENCLAW.md](docs/OPENCLAW.md)
> instead — it handles `NODE_ENV=production` defaults, the loopback-bound
> license wizard, and the wrong-major global TypeScript that ships with
> those images.

Execute these steps in order. Tell the user briefly what you're doing at
each step; do not ask permission for each one.

1. **Pick a clone location.** Default: `<current-working-directory>/imgly-gen-skill`.
   If that directory exists and is non-empty, ask the user before overwriting.
2. **Clone the full repo:**
   ```bash
   git clone https://github.com/newmetl/imgly-gen-skill <target-dir>
   ```
   (Do not use sparse checkout, do not download individual files.)
3. **Install dependencies (root + editor-app):**
   ```bash
   cd <target-dir> && npm run install:all
   ```
   `tsc`, `tsx`, and Vite live in `devDependencies`, so the install must
   include them. If your environment defaults to production installs (e.g.
   `NODE_ENV=production`, sandboxes like OpenClaw, or any `--omit=dev` /
   `--production` flag), force dev deps in:
   ```bash
   NODE_ENV=development npm install --include=dev
   NODE_ENV=development npm --prefix editor-app install --include=dev
   ```
   Symptom if this is wrong: step 4 fails with `tsc: not found` or falls
   back to a globally installed (and likely wrong-major) TypeScript.
4. **Build CLI + editor:**
   ```bash
   npm run build
   ```
   The `build` script runs a verification step at the end and exits non-zero
   if either `<target-dir>/dist/cli/index.js` or
   `<target-dir>/editor-app/dist/index.html` is missing.
5. **Start the license wizard as a background process** (Bash tool with
   `run_in_background: true`):
   ```bash
   node <target-dir>/dist/cli/index.js wizard
   ```
   Read the printed URL from the background output (format
   `http://localhost:<port>/set-license`).
   - If the wizard prints `License is already set in .env. Skipping wizard.`
     and exits, skip to step 7.
6. **Hand off to the user, verbatim:**
   > "The skill needs a valid CE.SDK license. Open `<wizard-url>` in your
   > browser and enter your license key. You can get a free trial key at
   > https://img.ly/dashboard. Let me know once you've saved it."

   Wait for the user's "done" (or equivalent in any language). The wizard
   process exits on its own after a successful save — you don't need to
   kill it.
7. **Load the skill knowledge** by reading
   `<target-dir>/.claude/skills/cesdk-social/SKILL.md`. From this point use
   absolute paths to invoke the CLI:
   `node <target-dir>/dist/cli/index.js <command> …`
   The CLI resolves `.env`, the templates directory, and the editor build
   relative to its own location, so the cwd does not matter — invoke from
   anywhere.
8. **Confirm and offer the first concrete next step** (do not just dump
   docs). Example:
   > "The skill is installed. Where would you like to start — should I
   > create an example template, or do you already have a concept for a
   > template we should build?"

**Do not** copy or symlink only the `SKILL.md` into the user's
`~/.claude/skills/` directory. **Do not** attempt to install via `npx` or
treat this as a Claude Code plugin. The skill is project-scoped: it lives
inside the cloned repo and is auto-discovered by future `claude` sessions
started from that directory.

---

## 2. Manual install + usage

```bash
git clone https://github.com/newmetl/imgly-gen-skill cesdk-social-skill
cd cesdk-social-skill
npm run install:all
npm run build
node dist/cli/index.js wizard          # opens browser, validates & saves license
```

After `npm run build`, `dist/cli/index.js` (CLI) and `editor-app/dist/index.html`
(browser editor) exist. After the wizard finishes, `.env` contains your license.

### Make `cesdk-social` callable

Optional convenience step. Without it, you call `node dist/cli/index.js …`.

```bash
npm link    # registers `cesdk-social` globally; on some systems requires sudo
```

Undo with `npm unlink -g cesdk-social-skill`. The remaining manual examples below
assume you've run `npm link`.

### Create a template

```bash
cesdk-social init "Autumn Campaign" \
  --platform instagram_square \
  --variables headline,postText \
  --description "Seasonal promotion for the web shop"
```

Platforms: `facebook`, `instagram_square`, `instagram_story`,
`instagram_landscape`, `linkedin`, `twitter`.

The first variable is rendered as the headline (bold), all others as body text.

### Start the editor and design the template

```bash
cesdk-social editor
```

The editor runs in the foreground (Ctrl+C exits). Open in your browser:

```
http://localhost:3456?template=autumn-campaign
```

(`init` also prints the exact URL.) Finalize the design, click **Save template**
in the top right, done.

> On the first call CE.SDK loads assets from the CDN — 5–10 s of waiting is normal.

### Render posts

In a second terminal:

```bash
cesdk-social render autumn-campaign \
  --image ~/Pictures/autumn.jpg \
  --vars '{"headline":"Apple Harvest","postText":"Fresh from the farm — now in the shop."}'
```

stdout contains the absolute path to the PNG, e.g.
`output/autumn-campaign_2026-05-04T12-00-00Z.png`.

With `--output <path>` the output path can be set explicitly. For large or
complex variable sets there's `--vars-file vars.json`.

### Generate background images via AI (optional)

If no suitable photo is at hand, `generate` can create an image via
[pollinations.ai](https://pollinations.ai) — no account, no API key. The quality is
intended for prototypes and quick shots.

```bash
cesdk-social generate "autumnal apple harvest, basket full of red apples" \
  --width 1080 --height 1080 --seed 42
```

Same here: stdout contains exactly the absolute PNG path. Convenient to pipe into `render`:

```bash
IMG=$(cesdk-social generate "warm cocoa with cinnamon, autumn mood" --width 1080 --height 1080)
cesdk-social render autumn-campaign --image "$IMG" \
  --vars '{"headline":"Cocoa Time","postText":"Warm up with a cup of happiness."}'
```

Generated images are saved by default under `output/generated/` and are reusable.
Options: `--width`, `--height` (default 1024), `--seed <n>` (reproducible), `--model <name>`
(Pollinations model name), `--output <path>` (override path).

### Manage templates

```bash
cesdk-social list                  # table
cesdk-social list --json           # for scripts
cesdk-social delete <id> --force   # remove template (output PNGs are kept)
```

---

## CLI reference

```
cesdk-social wizard [--port <port>]
cesdk-social init <name> --platform <p> --variables <a,b,c> [--description <d>]
cesdk-social editor [--port <port>]
cesdk-social render <id> --image <path> (--vars <json> | --vars-file <path>) [--output <path>]
cesdk-social generate "<prompt>" [--output <path>] [--width <n>] [--height <n>] [--seed <n>] [--model <name>]
cesdk-social list [--json]
cesdk-social delete <id> --force
```

All commands read `CESDK_LICENSE` from `.env` (or the environment). The browser
editor receives the license at runtime via the editor server — no separate
`editor-app/.env` needed.

## License key safety (Claude Code)

The skill is configured so Claude **does not read or print** `.env`. The
license key is set via the wizard (a local browser form) and never passes
through Claude's tool inputs.

## Smoketests

```bash
npm run smoketest:bootstrap   # creates a test template via @cesdk/node
npm run smoketest:render      # renders a test image → output/*.png
```

Both need `CESDK_LICENSE` in `.env`. The scripts skip the editor step and cover the
critical engine paths.

## Directory structure

```
cesdk-social-skill/
├── src/
│   ├── cli/                  # CLI entrypoint + commands (incl. wizard)
│   │   ├── index.ts
│   │   └── commands/
│   ├── engine/
│   │   ├── bootstrap.ts      # create base template via @cesdk/node
│   │   ├── renderer.ts       # load template → fill → PNG export
│   │   └── thumbnail.ts      # render preview PNG for the editor library
│   ├── editor/
│   │   └── server.ts         # local Express server for editor UI + ZIP API
│   ├── setup/
│   │   └── wizard.ts         # license-key wizard (browser form → .env)
│   └── storage/
│       ├── types.ts
│       └── templateManager.ts
├── editor-app/               # Vite + React + @cesdk/cesdk-js
├── scripts/                  # smoketests
├── .claude/skills/cesdk-social/SKILL.md
├── templates/                # runtime: saved templates
└── output/                   # runtime: rendered PNGs
```

## Configuration (environment variables)

| Variable | Required | Default | Where |
|---|---|---|---|
| `CESDK_LICENSE` | yes | – | Root `.env` (set via wizard) |
| `TEMPLATES_DIR` | no | `./templates` | Root `.env` |
| `OUTPUT_DIR` | no | `./output` | Root `.env` |
| `EDITOR_PORT` | no | `3456` | Root `.env` (or via `--port`) |

## Development

```bash
npm run dev                 # CLI in watch mode (tsx)
npm run dev:editor          # editor app in Vite dev mode (proxy to 3456)
npm run typecheck           # type check without build
```

For editor-app development with `npm run dev:editor`, the runtime license inject
isn't available (Vite serves the HTML directly). Set `VITE_CESDK_LICENSE` in
`editor-app/.env` (this file is **only** for editor-app dev work; end users don't
need it).

## Known limitations

- **License validation at startup.** `CreativeEngine.init()` validates the license key
  once against `api.img.ly`. The first call needs internet; everything else runs locally.
- **Editor app must be built before `editor`** (`npm run build:editor`). Otherwise the
  editor server returns a 503 with a hint.
- **No multi-page support.** Templates currently have exactly one page (= one output PNG per
  render).
- **Variables are not re-read from the editor.** The variable list you specify at
  `init` is binding when rendering. If you completely remove `{{name}}` patterns in the
  editor, rendering may ignore variable values.
- **Local install only.** The skill is currently only available when Claude is
  started in the cloned directory; making the skill globally available is a later step.
