# cesdk-social-skill

CLI + Claude Code skill for generating social media images with
[CE.SDK](https://img.ly/products/creative-sdk) by img.ly.

The workflow: you design a template once in the local browser editor, then fill it
again and again with different texts and images — either manually via the CLI
or through Claude Code, which operates the CLI for you.

## How do I use this?

Two ways — pick one:

1. **[Manually via the CLI](#1-manual-usage-via-cli)** — no AI tool required.
2. **[With Claude Code as a skill](#2-usage-with-claude-code)** — Claude operates the CLI for you.

In both cases the setup is identical.

## Requirements

- Node.js >= 18 (tested with 24)
- A valid CE.SDK license key — get a free trial key at
  [img.ly/dashboard](https://img.ly/dashboard).

## Setup (one-time)

```bash
git clone <repo-url> cesdk-social-skill
cd cesdk-social-skill
npm run install:all
cp .env.example .env
cp editor-app/.env.example editor-app/.env
# In .env:            CESDK_LICENSE=…
# In editor-app/.env: VITE_CESDK_LICENSE=…
npm run build
```

After `npm run build`, `dist/cli/index.js` (CLI) and `editor-app/dist/index.html`
(browser editor) exist.

### Make the CLI callable

The `cesdk-social` command isn't on your `PATH` after the build. Three options:

**a) `npm link` (recommended, one-time action)** — registers `cesdk-social` globally:

```bash
npm link
```

After that the examples below work directly. On some systems this requires `sudo`. Undo
with `npm unlink -g cesdk-social-skill`.

**b) Call via `node`** — no setup, but a longer command:

```bash
node dist/cli/index.js init "Autumn Campaign" --platform instagram_square --variables headline,postText
```

In the examples below, replace each `cesdk-social` with `node dist/cli/index.js`.

**c) Via `npm run …`** — `npm run start -- <args>` invokes the CLI, but with the `--` separator:

```bash
npm run start -- init "Autumn Campaign" --platform instagram_square --variables headline,postText
```

---

## 1. Manual usage via CLI

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

## 2. Usage with Claude Code

The repo contains a skill at [.claude/skills/cesdk-social/SKILL.md](.claude/skills/cesdk-social/SKILL.md).
As soon as you open the repo in Claude Code, Claude loads the skill automatically.

Flow of a session:

1. **"Create a new Instagram square template 'Autumn Campaign' with variables headline and
   postText."**
   → Claude checks the setup, builds the project if needed, and/or asks you to enter your
   license key in `.env`.
   → Claude calls `cesdk-social init`.

2. Claude starts the editor in the background and gives you the URL
   `http://localhost:3456?template=autumn-campaign`. You design the template in the browser and
   save it.

3. **"Generate 3 posts: apple harvest, pumpkin soup, warm cocoa. Image: ~/Pictures/autumn.jpg."**
   → Claude formulates a headline + body per post and calls `cesdk-social render` three times.
   → You get the 3 output paths.

### License key safety

The skill is configured so Claude **does not read or print** `.env` files. The
license key does not leave your machine.

---

## CLI reference

```
cesdk-social init <name> --platform <p> --variables <a,b,c> [--description <d>]
cesdk-social editor [--port <port>]
cesdk-social render <id> --image <path> (--vars <json> | --vars-file <path>) [--output <path>]
cesdk-social generate "<prompt>" [--output <path>] [--width <n>] [--height <n>] [--seed <n>] [--model <name>]
cesdk-social list [--json]
cesdk-social delete <id> --force
```

All commands read `CESDK_LICENSE` from `.env` (or the environment). The editor additionally
reads `VITE_CESDK_LICENSE` from `editor-app/.env`.

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
│   ├── cli/                  # CLI entrypoint + commands
│   │   ├── index.ts
│   │   └── commands/
│   ├── engine/
│   │   ├── bootstrap.ts      # create base template via @cesdk/node
│   │   └── renderer.ts       # load template → fill → PNG export
│   ├── editor/
│   │   └── server.ts         # local Express server for editor UI + ZIP API
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
| `CESDK_LICENSE` | yes | – | Root `.env` |
| `VITE_CESDK_LICENSE` | yes (editor) | – | `editor-app/.env` |
| `TEMPLATES_DIR` | no | `./templates` | Root `.env` |
| `OUTPUT_DIR` | no | `./output` | Root `.env` |
| `EDITOR_PORT` | no | `3456` | Root `.env` (or via `--port`) |

## Development

```bash
npm run dev                 # CLI in watch mode (tsx)
npm run dev:editor          # editor app in Vite dev mode (proxy to 3456)
npm run typecheck           # type check without build
```

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
