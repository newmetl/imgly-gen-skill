---
name: cesdk-social
description: Generates social media images (Instagram, Facebook, LinkedIn, Twitter posts and stories) from CE.SDK templates. Triggers when the user wants to produce posts in a consistent visual style — they design a template once in a local browser editor, then the skill fills it with text and image via CLI and exports PNGs.
---

# cesdk-social — Social media posts from CE.SDK templates

This repo contains a CLI plus a local browser editor with which the user designs templates once. You then fill them with text and image and render PNGs.

You always invoke the CLI via the **absolute path** to `dist/cli/index.js`:

```bash
node <repo-root>/dist/cli/index.js <command> …
```

Replace `<repo-root>` with the absolute path of the cloned repo (the directory containing this SKILL.md, three levels up from `.claude/skills/cesdk-social/`). The CLI resolves `.env`, the templates directory, and the editor build relative to its own location, so **the cwd does not matter** — you can invoke it from anywhere. Don't rely on `cesdk-social` being on the PATH; that's only true when the user has run `npm link` manually.

All CLI output and error messages are in English. Reply to the user in whichever language they write to you, but keep the literal CLI strings (commands, flags, status lines) verbatim.

---

## Important: license key handling (security)

The CE.SDK license key lives in `.env`. It is sensitive.

**Never:**
- Open `.env` with the Read tool.
- Apply `cat .env`, `head .env`, `tail .env`, `grep CESDK .env`, `xxd`, `awk` etc.
- Run `env`, `printenv`, `echo $CESDK_LICENSE` or similar.
- Pass the key value as an argument to any tool.

**You may:** check whether `.env` exists (`ls .env`) and run the `wizard` command (it writes the file via a browser form; it does not show the value to you).

**Never set the key yourself** by writing to `.env` directly. Always use the wizard.

---

## Setup check (before first use per session)

Before any other `cesdk-social` command, run this check in order:

### 1. Build present?

Do `dist/cli/index.js` AND `editor-app/dist/index.html` exist? If not:

```bash
npm --prefix <repo-root> run install:all && npm --prefix <repo-root> run build
```

The `build` script verifies both artifacts and exits non-zero if anything is missing.

### 2. License present?

Run the wizard. It is idempotent — exits immediately if the license is already set.

```bash
node <repo-root>/dist/cli/index.js wizard
```

**Run the wizard as a background process** (Bash tool with `run_in_background: true`).

If the license is already set, the wizard prints `License is already set in .env. Skipping wizard.` and exits. You can proceed.

If the license is missing, the wizard prints a URL like `http://localhost:3458/set-license` and stays running. Read the URL from the output and tell the user **verbatim**:

> "The skill needs a valid CE.SDK license. Open [http://localhost:3458/set-license](http://localhost:3458/set-license) in your browser and enter your license key. You can get a free trial key at https://img.ly/dashboard. Let me know once you've saved it."

Wait for the user's "done" (or equivalent in any language). Once they confirm, the wizard background process has already exited on its own (it terminates after a successful save). You can then proceed.

If the user reports an error in the wizard ("Validation failed"), the key is wrong — ask them to retry on the same wizard page; it remains open until a valid key is saved.

---

## Workflow

### Create a new template

```bash
node <repo-root>/dist/cli/index.js init "<display name>" \
  --platform <platform> \
  --variables <var1,var2,...> \
  --description "<short description>"
```

- **Platforms:** `facebook`, `instagram_square`, `instagram_story`, `instagram_landscape`, `linkedin`, `twitter`
- **Variables:** comma-separated list. First = headline (bold), rest = body. Example: `headline,postText`.

stdout contains the `templateId` (slugified from the name) and the editor URL.

### Start the editor and involve the user

Start the editor **as a background process**:

```bash
node <repo-root>/dist/cli/index.js editor
```

Read the URL `http://localhost:3456` from the output (or the `--port` you chose).

Tell the user:
> "Open http://localhost:3456?template=<id> in your browser, finalize the design and click **Save template** in the top right. Let me know when you're done."

Wait for confirmation. On the first call CE.SDK loads assets from the CDN — 5–10 s of waiting is normal.

### Render posts

As soon as the user says "done":

```bash
node <repo-root>/dist/cli/index.js render <id> \
  --image <absolute-image-path> \
  --vars '{"headline":"…","postText":"…"}'
```

The absolute path to the generated PNG is printed to stdout (one line, nothing else). Default output directory: `<repo-root>/output/<id>_<timestamp>.png`. Overridable with `--output <path>`.

For multiple posts: just call `render` multiple times — each call produces its own PNG with a timestamp.

### Generate a background image via Pollinations.ai

If the user provides no photo or explicitly wants an AI-generated image: create one via `generate`. No API key, no account.

```bash
node <repo-root>/dist/cli/index.js generate "<prompt>" \
  [--width 1024] [--height 1024] [--seed <n>] [--model <name>] [--output <path>]
```

Default 1024×1024, output under `<repo-root>/output/generated/<slug>_<timestamp>.png`. stdout contains only the absolute path — pipe directly into `render`:

```bash
IMG=$(node <repo-root>/dist/cli/index.js generate "warm cocoa cinnamon autumn mood" --width 1080 --height 1080)
node <repo-root>/dist/cli/index.js render <id> --image "$IMG" --vars '{"headline":"…","postText":"…"}'
```

For a post series with a similar look: set `--seed <n>` once so the same prompt yields reproducible images. Pollinations is an external service — internet required, response time 5–15 s per image. Quality is prototype-level, not production-grade; on "make me a high-quality marketing image" warn the user that they're better off providing their own photo.

### Stop the editor

When the user has no more render jobs: kill the background process (KillShell).

---

## Other commands

```bash
node <repo-root>/dist/cli/index.js list              # human-readable table
node <repo-root>/dist/cli/index.js list --json       # for programmatic processing
node <repo-root>/dist/cli/index.js delete <id> --force
```

`delete` removes the template archive and the metadata; already-rendered PNGs in `output/` are kept.

---

## Variables via JSON file (for batches)

Instead of `--vars '{…}'`, `--vars-file vars.json` works too. Useful for loops with different contents or when the JSON string is too long/unusual for the shell.

```bash
node <repo-root>/dist/cli/index.js render autumn-campaign \
  --image ~/Pictures/apple.jpg \
  --vars-file ./posts/post-01.json
```

---

## Common errors

| Error | Cause | Reaction |
|---|---|---|
| `CESDK_LICENSE is not set` | License missing in `.env` | Run the wizard. **Don't read `.env` yourself.** |
| `Editor app is not built yet` | `editor-app/dist/` missing | Run `npm run build:editor` |
| `Template '…' not found` | Wrong ID | `node <root>/dist/cli/index.js list` to correct |
| Port 3456 in use | Another process holds the port | Start with `editor --port <other>` |
| `Template '…' already exists` (on `init`) | Slug collision | Choose a different name or remove the old template via `delete --force` |
| `Pollinations.ai responded with HTTP …` (on `generate`) | Service unreachable or prompt filter | Try again; on repeated failure suggest the user provide their own image |

---

## Typical sequence (fresh install)

1. User: "Create an Instagram square template 'Autumn Campaign' with headline and body."
2. You: setup check → build present? license present? (run wizard if not, hand URL to user, wait)
3. You: `node <root>/dist/cli/index.js init "Autumn Campaign" --platform instagram_square --variables headline,postText`
4. You: `node <root>/dist/cli/index.js editor` (in the background) → extract URL
5. You to user: "Open http://localhost:3456?template=autumn-campaign, design and save the template. Let me know."
6. User: "Done."
7. User: "Generate 3 posts: apple harvest, pumpkin soup, warm cocoa. Image: ~/Pictures/autumn.jpg."
8. You formulate a headline + body per post and call `render` 3×.
9. You give the user the 3 output paths.
10. On request: stop the editor process.
