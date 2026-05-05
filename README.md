# cesdk-social-skill

CLI + Claude-Code-Skill für die Generierung von Social-Media-Bildern mit
[CE.SDK](https://img.ly/products/creative-sdk) von img.ly.

Der Workflow: Du gestaltest ein Template einmalig im lokalen Browser-Editor und befüllst es
anschließend immer wieder mit unterschiedlichen Texten und Bildern — entweder von Hand per CLI
oder über Claude Code, der die CLI für dich bedient.

## Wie nutze ich das?

Zwei Wege — du wählst:

1. **[Manuell per CLI](#1-manuelle-nutzung-per-cli)** — kein KI-Tool nötig.
2. **[Mit Claude Code als Skill](#2-nutzung-mit-claude-code)** — Claude bedient die CLI für dich.

In beiden Fällen ist das Setup identisch.

## Voraussetzungen

- Node.js >= 18 (getestet mit 24)
- Ein gültiger CE.SDK Lizenzschlüssel — kostenlosen Trial-Key gibt's unter
  [img.ly/dashboard](https://img.ly/dashboard).

## Setup (einmalig)

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

Nach `npm run build` existieren `dist/cli/index.js` (CLI) und `editor-app/dist/index.html`
(Browser-Editor).

### CLI aufrufbar machen

Der Befehl `cesdk-social` ist nach dem Build noch nicht im `PATH`. Drei Möglichkeiten:

**a) `npm link` (empfohlen, einmalige Aktion)** — registriert `cesdk-social` global:

```bash
npm link
```

Danach funktionieren die Beispiele unten direkt. Auf manchen Systemen braucht das `sudo`. Rückgängig
mit `npm unlink -g cesdk-social-skill`.

**b) Über `node` aufrufen** — kein Setup, aber längerer Befehl:

```bash
node dist/cli/index.js init "Herbst-Kampagne" --platform instagram_square --variables headline,postText
```

In den Beispielen unten dann jedes `cesdk-social` durch `node dist/cli/index.js` ersetzen.

**c) Über `npm run …`** — `npm run start -- <args>` ruft die CLI auf, allerdings mit dem `--`-Trenner:

```bash
npm run start -- init "Herbst-Kampagne" --platform instagram_square --variables headline,postText
```

---

## 1. Manuelle Nutzung per CLI

### Template anlegen

```bash
cesdk-social init "Herbst-Kampagne" \
  --platform instagram_square \
  --variables headline,postText \
  --description "Saisonale Aktion für Webshop"
```

Plattformen: `facebook`, `instagram_square`, `instagram_story`,
`instagram_landscape`, `linkedin`, `twitter`.

Die erste Variable wird als Headline (bold) gerendert, alle weiteren als Body-Text.

### Editor starten und Template gestalten

```bash
cesdk-social editor
```

Der Editor läuft im Vordergrund (Ctrl+C beendet ihn). Im Browser öffnen:

```
http://localhost:3456?template=herbst-kampagne
```

(Die exakte URL liefert auch `init` aus.) Design fertigstellen, oben rechts auf
**Template speichern** klicken, fertig.

> Beim ersten Aufruf lädt CE.SDK Assets vom CDN — 5–10 s Wartezeit ist normal.

### Posts rendern

In einem zweiten Terminal:

```bash
cesdk-social render herbst-kampagne \
  --image ~/Bilder/herbst.jpg \
  --vars '{"headline":"Apfelernte","postText":"Frisch vom Hof — jetzt im Shop."}'
```

stdout enthält den absoluten Pfad zur PNG, z. B.
`output/herbst-kampagne_2026-05-04T12-00-00Z.png`.

Mit `--output <pfad>` kann der Output-Pfad explizit gesetzt werden. Für umfangreiche oder
komplexe Variablen-Sets gibt's `--vars-file vars.json`.

### Templates verwalten

```bash
cesdk-social list                  # Tabelle
cesdk-social list --json           # für Skripte
cesdk-social delete <id> --force   # Template entfernen (Output-PNGs bleiben)
```

---

## 2. Nutzung mit Claude Code

Das Repo enthält einen Skill unter [.claude/skills/cesdk-social/SKILL.md](.claude/skills/cesdk-social/SKILL.md).
Sobald du das Repo in Claude Code öffnest, lädt Claude den Skill automatisch.

Ablauf einer Session:

1. **„Lege ein neues Instagram-Quadrat-Template ‚Herbst-Kampagne' mit Variablen headline und
   postText an."**
   → Claude prüft das Setup, ggf. baut er das Projekt und/oder bittet dich, deinen Lizenzschlüssel
   in `.env` einzutragen.
   → Claude ruft `cesdk-social init` auf.

2. Claude startet den Editor im Hintergrund und gibt dir die URL
   `http://localhost:3456?template=herbst-kampagne`. Du gestaltest das Template im Browser und
   speicherst es.

3. **„Generiere 3 Posts: Apfelernte, Kürbissuppe, warmer Kakao. Bild: ~/Bilder/herbst.jpg."**
   → Claude formuliert pro Post Headline + Body und ruft `cesdk-social render` dreimal auf.
   → Du bekommst die 3 Output-Pfade.

### Sicherheit beim Lizenzschlüssel

Der Skill ist so konfiguriert, dass Claude `.env`-Dateien **nicht liest und nicht ausgibt**. Der
Lizenzschlüssel verlässt deine Maschine nicht.

---

## CLI-Referenz

```
cesdk-social init <name> --platform <p> --variables <a,b,c> [--description <d>]
cesdk-social editor [--port <port>]
cesdk-social render <id> --image <pfad> (--vars <json> | --vars-file <pfad>) [--output <pfad>]
cesdk-social list [--json]
cesdk-social delete <id> --force
```

Alle Befehle lesen `CESDK_LICENSE` aus `.env` (oder der Umgebung). Der Editor zusätzlich
`VITE_CESDK_LICENSE` aus `editor-app/.env`.

## Smoketests

```bash
npm run smoketest:bootstrap   # erzeugt ein Test-Template per @cesdk/node
npm run smoketest:render      # rendert ein Test-Bild → output/*.png
```

Beide brauchen `CESDK_LICENSE` in `.env`. Die Skripte umgehen den Editor-Schritt und decken die
kritischen Engine-Pfade ab.

## Verzeichnisstruktur

```
cesdk-social-skill/
├── src/
│   ├── cli/                  # CLI-Entrypoint + Befehle
│   │   ├── index.ts
│   │   └── commands/
│   ├── engine/
│   │   ├── bootstrap.ts      # Basis-Template per @cesdk/node erzeugen
│   │   └── renderer.ts       # Template laden → fillen → PNG export
│   ├── editor/
│   │   └── server.ts         # Lokaler Express-Server für Editor-UI + ZIP-API
│   └── storage/
│       ├── types.ts
│       └── templateManager.ts
├── editor-app/               # Vite + React + @cesdk/cesdk-js
├── scripts/                  # Smoketests
├── .claude/skills/cesdk-social/SKILL.md
├── templates/                # Runtime: gespeicherte Templates
└── output/                   # Runtime: gerenderte PNGs
```

## Konfiguration (Umgebungsvariablen)

| Variable | Pflicht | Standard | Wo |
|---|---|---|---|
| `CESDK_LICENSE` | ja | – | Root `.env` |
| `VITE_CESDK_LICENSE` | ja (Editor) | – | `editor-app/.env` |
| `TEMPLATES_DIR` | nein | `./templates` | Root `.env` |
| `OUTPUT_DIR` | nein | `./output` | Root `.env` |
| `EDITOR_PORT` | nein | `3456` | Root `.env` (oder per `--port`) |

## Entwicklung

```bash
npm run dev                 # CLI im Watch-Modus (tsx)
npm run dev:editor          # Editor-App im Vite-Dev-Modus (Proxy auf 3456)
npm run typecheck           # Type-Check ohne Build
```

## Bekannte Einschränkungen

- **Lizenz-Validierung beim Start.** `CreativeEngine.init()` validiert den Lizenzschlüssel
  einmalig gegen `api.img.ly`. Der erste Aufruf braucht Internet; alles weitere läuft lokal.
- **Editor-App muss vor `editor` gebaut sein** (`npm run build:editor`). Sonst liefert der
  Editor-Server eine 503 mit Hinweis.
- **Kein Multi-Page-Support.** Templates haben aktuell genau eine Page (= ein Output-PNG pro
  Render).
- **Variablen werden nicht erneut aus dem Editor ausgelesen.** Die Variablen-Liste, die du beim
  `init` angibst, ist beim Rendern bindend. Wenn du im Editor `{{name}}`-Patterns komplett
  entfernst, kann das Rendering Variablen-Werte ignorieren.
