---
name: cesdk-social
description: Generates social media images (Instagram, Facebook, LinkedIn, Twitter posts and stories) from CE.SDK templates. Triggers when the user wants to produce posts in a consistent visual style — they design a template once in a local browser editor, then the skill fills it with text and image via CLI and exports PNGs.
---

# cesdk-social — Social media posts from CE.SDK templates

This repo contains a CLI (`cesdk-social`) plus a local browser editor with which a user designs templates once. You then fill them with text and image and render PNGs.

---

## Important: license key handling (security)

The CE.SDK license key lives in `.env` and `editor-app/.env`. It is sensitive.

**Never:**
- Open `.env` or `editor-app/.env` with the Read tool.
- Apply `cat .env`, `head .env`, `tail .env`, `grep CESDK .env`, `xxd .env`, `awk` or similar to these files.
- Run `env`, `printenv`, `echo $CESDK_LICENSE` or similar.
- Pass the key value as an argument to any tool.

**If a command fails with "CESDK_LICENSE is not set":** ask the user to check their `.env` contents — do not inspect the file yourself.

---

## Setup check (before first use per session)

Before you issue any `cesdk-social` command, check in this order:

1. **Build present?** Do `dist/cli/index.js` AND `editor-app/dist/index.html` exist? If not:
   ```bash
   npm run install:all && npm run build
   ```

2. **`.env` present?** Do `.env` AND `editor-app/.env` exist? If not:
   ```bash
   cp .env.example .env
   cp editor-app/.env.example editor-app/.env
   ```
   Then **stop and tell the user** verbatim:
   > "I created `.env` and `editor-app/.env` from the templates. Please open both files and enter your CE.SDK license key (variables `CESDK_LICENSE` and `VITE_CESDK_LICENSE`). Get the trial key at https://img.ly/dashboard. Let me know when you're done."
   
   Wait for their confirmation before proceeding.

---

## Workflow

> Note on the commands: you consistently use `node dist/cli/index.js …`, because `cesdk-social`
> would only be on the PATH after a manual `npm link`. With `node dist/cli/index.js` the CLI
> always runs without additional setup steps from the user.

### Create a new template

```bash
node dist/cli/index.js init "<display name>" \
  --platform <platform> \
  --variables <var1,var2,...> \
  --description "<short description>"
```

- **Platforms:** `facebook`, `instagram_square`, `instagram_story`, `instagram_landscape`, `linkedin`, `twitter`
- **Variables:** comma-separated list. First = headline (bold), rest = body. Example: `headline,postText`.

stdout contains the `templateId` (slugified from the name) and the later editor URL.

### Start the editor and involve the user

Start the editor **as a background process** (Bash tool with `run_in_background: true`):

```bash
node dist/cli/index.js editor
```

Read the URL `http://localhost:3456` from the output (or the port you chose with `--port`).

Tell the user:
> "Open http://localhost:3456?template=<id> in your browser, finalize the design and click **Save template** in the top right. Let me know when you're done."

Wait for confirmation. On the first call CE.SDK loads assets from the CDN — 5–10 s of waiting is normal.

### Render posts

As soon as the user says "done":

```bash
node dist/cli/index.js render <id> \
  --image <absolute-image-path> \
  --vars '{"headline":"…","postText":"…"}'
```

The absolute path to the generated PNG is printed to stdout (one line, nothing else). Default output directory: `output/<id>_<timestamp>.png`. Overridable with `--output <path>`.

For multiple posts: just call `render` multiple times — each call produces its own PNG with a timestamp.

### Generate a background image via Pollinations.ai

If the user provides no photo or explicitly wants an AI-generated image: create one via `generate`. No API key, no account.

```bash
node dist/cli/index.js generate "<prompt>" \
  [--width 1024] [--height 1024] [--seed <n>] [--model <name>] [--output <path>]
```

Default 1024×1024, output under `output/generated/<slug>_<timestamp>.png`. stdout contains only the absolute path — pipe directly into `render`:

```bash
IMG=$(node dist/cli/index.js generate "warm cocoa cinnamon autumn mood" --width 1080 --height 1080)
node dist/cli/index.js render <id> --image "$IMG" --vars '{"headline":"…","postText":"…"}'
```

For a post series with a similar look: set `--seed <n>` once so the same prompt yields reproducible images. Pollinations is an external service — internet required, response time 5–15 s per image. Quality is prototype-level, not production-grade; on "make me a high-quality marketing image" warn the user that they're better off providing their own photo.

### Stop the editor

When the user has no more render jobs: kill the background process (KillShell).

---

## Other commands

```bash
node dist/cli/index.js list              # human-readable table
node dist/cli/index.js list --json       # for programmatic processing
node dist/cli/index.js delete <id> --force
```

`delete` removes the template archive and the metadata; already-rendered PNGs in `output/` are kept.

---

## Variables via JSON file (for batches)

Instead of `--vars '{…}'`, `--vars-file vars.json` works too. Useful for loops with different contents or when the JSON string is too long/unusual for the shell.

```bash
node dist/cli/index.js render autumn-campaign \
  --image ~/Pictures/apple.jpg \
  --vars-file ./posts/post-01.json
```

---

## Common errors

| Error | Cause | Reaction |
|---|---|---|
| `CESDK_LICENSE is not set` | Empty/missing `.env` | Ask user to enter the key in `.env`. **Don't read the file yourself.** |
| `Editor app is not built yet` | `editor-app/dist/` missing | Run `npm run build:editor` |
| `Template '…' not found` | Wrong ID | `node dist/cli/index.js list` to correct |
| Port 3456 in use | Another process holds the port | Start with `cesdk-social editor --port <other>` |
| `Template '…' already exists` (on `init`) | Slug collision | Choose a different name or remove the old template via `delete --force` |
| `Pollinations.ai responded with HTTP …` (on `generate`) | Service unreachable or prompt filter | Try again; on repeated failure suggest the user provide their own image |

---

## Typical sequence (example)

1. User: "Create an Instagram square template 'Autumn Campaign' with headline and body."
2. You: `node dist/cli/index.js init "Autumn Campaign" --platform instagram_square --variables headline,postText`
3. You: `node dist/cli/index.js editor` (in the background) → extract URL
4. You to user: "Open http://localhost:3456?template=autumn-campaign, design and save the template. Let me know."
5. User: "Done."
6. User: "Generate 3 posts: apple harvest, pumpkin soup, warm cocoa. Image: ~/Pictures/autumn.jpg."
7. You formulate a headline + body per post and call `render` 3×.
8. You give the user the 3 output paths.
9. On request: stop the editor process.
