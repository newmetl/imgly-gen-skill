# OpenClaw install runbook

This is the install runbook for AI agents (Claude Code, etc.) running
inside an [OpenClaw](https://openclaw.dev) container or any other
sandbox where the workspace lives in a Linux container separate from the
user's host machine.

If you are running on the user's local machine, follow the runbook in
[../README.md](../README.md#claude-code-install-runbook) instead.

## Why a separate runbook

Containerised environments break three assumptions the default runbook
makes:

1. **Production-only installs.** OpenClaw containers typically have
   `NODE_ENV=production` (or otherwise pass `--omit=dev`), so `npm install`
   skips the `tsc`, `tsx`, and Vite binaries the build needs.
2. **Loopback isolation.** The license wizard binds to `127.0.0.1` inside
   the container ([src/setup/wizard.ts:320](../src/setup/wizard.ts#L320)).
   The user's browser runs on a *different* machine and cannot reach a
   container-loopback port unless OpenClaw forwards it explicitly.
3. **Pre-installed globals at the wrong version.** OpenClaw images ship
   with a global TypeScript at `/app/node_modules/.bin/tsc` whose major
   version may not match the project's pin (`^5.7.2`). Falling back to
   the global tsc can produce confusing build failures unrelated to your
   code.

The steps below address each of these.

## Runbook

Execute these steps in order. The target directory in OpenClaw is
typically `/home/node/.openclaw/workspace/imgly-gen-skill` — substitute
your actual workspace path for `<target-dir>` below. Use absolute paths
throughout so cwd changes don't break later steps.

### 1. Clone

```bash
git clone https://github.com/newmetl/imgly-gen-skill <target-dir>
```

Do not use sparse checkout. The skill needs the full repo (CLI source,
editor app, templates).

### 2. Install dependencies — *with* devDependencies

The default `npm run install:all` will silently skip dev deps under
`NODE_ENV=production`. Force them in:

```bash
cd <target-dir>
NODE_ENV=development npm install --include=dev
NODE_ENV=development npm --prefix editor-app install --include=dev
```

**Verify** that the local TypeScript landed:

```bash
ls <target-dir>/node_modules/.bin/tsc <target-dir>/node_modules/.bin/tsx
node <target-dir>/node_modules/typescript/bin/tsc --version
```

The version must start with `5.` (currently `5.9.x`). If it shows `6.x`
or `Cannot find module`, you are still resolving the global TypeScript
— re-check `NODE_ENV` and the `--include=dev` flag.

### 3. Build CLI + editor

```bash
cd <target-dir> && npm run build
```

The `build` script runs a verification step at the end and exits
non-zero if either `<target-dir>/dist/cli/index.js` or
`<target-dir>/editor-app/dist/index.html` is missing.

If you see `tsc: not found`, step 2 was skipped — go back. **Do not**
work around it by prepending `/app/node_modules/.bin` to `PATH`; that
gives you the wrong-major TypeScript.

### 4. License setup — *do not* use the browser wizard

The default runbook starts a browser wizard at `http://localhost:<port>`.
In a container that URL is unreachable from the user's browser. Use one
of the two approaches below instead.

#### 4a. Direct write (recommended in OpenClaw)

Ask the user for their CE.SDK license key directly:

> "I'm running in a container, so the browser wizard isn't reachable
> from your machine. Please paste your CE.SDK license key here and I'll
> write it to `.env` directly. You can get a free trial key at
> <https://img.ly/dashboard>."

Once they paste it, write `.env` using the project's own helper so
formatting matches what the rest of the code expects:

```bash
cd <target-dir>
node --input-type=module -e "
  import('./dist/setup/wizard.js').then(({ writeLicense }) => {
    writeLicense(process.argv[1]);
    console.log('License written to .env');
  });
" "<paste-key-here>"
```

`writeLicense` ([src/setup/wizard.ts:59](../src/setup/wizard.ts#L59))
preserves the rest of `.env`, replaces an existing `CESDK_LICENSE=` line
if present, and appends one otherwise. CE.SDK validates the key against
`api.img.ly` on first engine init, so an invalid key will surface on the
first CLI command — not silently.

> ⚠️ Treat the license key as a secret. Do not echo it back into the
> conversation transcript, do not commit `.env`, and do not include it in
> screenshots or logs you share.

#### 4b. Wizard with port forwarding (only if OpenClaw exposes it)

If your OpenClaw setup is known to forward container ports to the
user's browser (check the workspace UI for a "preview" or "port" tab),
you can still use the wizard — but you must rebind it from `127.0.0.1`
to `0.0.0.0` so the forwarder can reach it. There is no `--host` flag
yet, so use a small relay:

```bash
# Terminal 1 (background): start wizard on loopback as usual
node <target-dir>/dist/cli/index.js wizard --port 3458 &

# Terminal 2 (background): relay 0.0.0.0:3459 → 127.0.0.1:3458
node -e "
  const net = require('net');
  net.createServer((c) => {
    const u = net.createConnection(3458, '127.0.0.1');
    c.pipe(u); u.pipe(c);
    c.on('error', () => {}); u.on('error', () => {});
  }).listen(3459, '0.0.0.0', () => console.log('relay on :3459'));
" &
```

Then hand the user the *forwarded* URL for port 3459, not 3458.

If you don't know whether OpenClaw forwards ports, use 4a.

### 5. Hand off to the user

After the license is in `.env`, confirm and offer the first concrete
next step (do not just dump docs):

> "The skill is installed. Where would you like to start — should I
> create an example template, or do you already have a concept for a
> template we should build?"

### 6. Load the skill knowledge

Read `<target-dir>/.claude/skills/cesdk-social/SKILL.md`. From this
point use absolute paths to invoke the CLI:

```
node <target-dir>/dist/cli/index.js <command> …
```

The CLI resolves `.env`, the templates directory, and the editor build
relative to its own location, so cwd does not matter.

## Troubleshooting

### `tsc: not found` during build

DevDependencies were skipped. Re-run step 2 with `NODE_ENV=development`
and `--include=dev`. Don't fall back to the global TypeScript.

### Build fails with errors mentioning TS6.0 features

You are picking up `/app/node_modules/.bin/tsc` (TypeScript 6.x) instead
of the project-local 5.9.x. Check that `<target-dir>/node_modules/.bin/tsc`
exists and that it appears first in `PATH` when `npm run build` runs.
`npm run` automatically prepends `./node_modules/.bin` — if it's still
missing, the local install was skipped.

### Browser wizard URL doesn't load

The wizard binds to `127.0.0.1` and is unreachable across the container
boundary. Use approach 4a (direct write) instead of trying to fix the
forwarding.

### `.env` resets after a container restart

OpenClaw workspaces may have non-persistent layers. Verify with the
user. If `.env` is wiped, you'll need to re-run step 4 each session —
consider asking the user whether they want the key stored in an
OpenClaw secret/env var instead, and have the agent read it from
`process.env.CESDK_LICENSE` on each session boot.

### `npm run dev:editor` (Vite) doesn't open in the browser

Same root cause as the wizard: Vite binds to `localhost` by default.
Pass `--host 0.0.0.0` if you need it reachable. For the *built* editor
served by `dist/cli/index.js editor`, the Express server already binds
to all interfaces, so it should be reachable wherever OpenClaw forwards
its port.
