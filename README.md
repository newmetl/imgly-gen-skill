# cesdk-social-skill

MCP-Skill für KI-gestützte Social-Media-Bildgenerierung mit [CE.SDK](https://img.ly/products/creative-sdk) von img.ly.

Ein KI-Agent (z. B. Claude Code, Cursor) nutzt den Skill, um eigenständig Social-Media-Posts in einem
konsistenten visuellen Stil zu produzieren. Der Stil wird vom Nutzer einmalig in einem lokalen
Browser-Editor festgelegt; der Agent befüllt das Template anschließend mit Text und Bild und
exportiert PNGs.

## Architektur in drei Sätzen

Der Skill ist ein MCP-Server (stdio), der dem Agenten fünf Tools zur Verfügung stellt:
`setup_template`, `confirm_template`, `list_templates`, `render_post`, `delete_template`. Templates
werden mit der headless Engine `@cesdk/node` als Basis-Layout angelegt, vom Nutzer in einer lokalen
Vite/React-App mit `@cesdk/cesdk-js` visuell finalisiert und beim Rendern wieder vom Server geladen.
Alle Daten (Templates, Outputs) liegen lokal auf der Festplatte; einzige Netzwerk-Abhängigkeit ist
die einmalige Lizenz-Validierung gegen `api.img.ly` beim Start.

## Voraussetzungen

- Node.js >= 18 (getestet mit 24)
- Ein gültiger CE.SDK Lizenzschlüssel — kostenlosen Trial-Key gibt es unter
  [img.ly/dashboard](https://img.ly/dashboard).

## Installation

```bash
git clone <repo-url> cesdk-social-skill
cd cesdk-social-skill
npm run install:all   # installiert Root + editor-app
```

`.env` aus Vorlage erstellen und Lizenz eintragen:

```bash
cp .env.example .env
cp editor-app/.env.example editor-app/.env
# anschließend in beiden Dateien CESDK_LICENSE / VITE_CESDK_LICENSE setzen
```

Build erzeugen:

```bash
npm run build         # baut Server (dist/) und Editor-App (editor-app/dist/)
```

## MCP-Server in einem Agenten registrieren

Beispiel-Konfiguration (`claude_desktop_config.json` oder `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "cesdk-social-skill": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absoluter/pfad/zu/cesdk-social-skill",
      "env": {
        "CESDK_LICENSE": "your_license_key_here"
      }
    }
  }
}
```

Nach dem Start sollte der Agent die fünf Tools auflisten können.

## Tools

### `setup_template`

Legt ein neues Template an und startet den Editor-Server.

| Parameter | Typ | Beschreibung |
|---|---|---|
| `name` | string | Anzeigename, z. B. "Herbst-Kampagne". Wird zur Template-ID slugifiziert. |
| `description` | string | Kurzbeschreibung. |
| `platform` | enum | `facebook` \| `instagram_square` \| `instagram_story` \| `instagram_landscape` \| `linkedin` \| `twitter`. Bestimmt die Maße. |
| `variables` | string[] | Liste der Text-Variablen. Erste = Headline (bold), weitere = Body. |

Antwort enthält die `templateId` und `editorUrl`. Der Agent fordert den Nutzer auf, die URL im
Browser zu öffnen, das Design zu finalisieren und im Editor zu speichern.

### `confirm_template`

Validiert das gespeicherte Template, liest tatsächliche Variablen und Platzhalter aus und setzt den
Status auf `ready`. Erst danach ist `render_post` möglich.

### `list_templates`

Liefert alle bekannten Templates inklusive Status, Plattform und Variablen.

### `render_post`

Rendert einen Post: lädt das Template, befüllt Variablen, setzt das Bild in den Platzhalter,
exportiert als PNG. Liefert den absoluten Output-Pfad.

| Parameter | Typ | Beschreibung |
|---|---|---|
| `templateId` | string | ID eines `ready` Templates. |
| `variables` | Record<string,string> | Muss alle Variablen aus dem Template abdecken. |
| `imagePath` | string | Absoluter Pfad zur lokalen Bilddatei (PNG/JPG). |

### `delete_template`

Löscht ein Template inklusive Archiv und Metadaten. Erfordert `confirm: true`. Bereits gerenderte
Output-Bilder bleiben erhalten.

## Typischer Workflow

```
Agent ──> setup_template(name, description, platform, variables)
         <── { templateId, editorUrl }

Nutzer im Browser: Design fertigstellen, "Template speichern" klicken

Agent ──> confirm_template(templateId)
         <── { status: "ready", variables: [...] }

Agent ──> render_post(templateId, variables, imagePath)
         <── { outputPath: "/abs/.../id_2026-01-01T12-00-00Z.png" }
```

## Smoketests

```bash
# Erzeugt ein Basis-Template per @cesdk/node und prüft das ZIP
npm run smoketest:bootstrap

# Erzeugt Template, lädt ein Test-Bild von picsum.photos und rendert ein PNG
npm run smoketest:render
```

Beide brauchen `CESDK_LICENSE` in `.env`. Output landet in `templates/` und `output/`.

## Verzeichnisstruktur

```
cesdk-social-skill/
├── src/
│   ├── index.ts                  # MCP-Entrypoint (stdio)
│   ├── mcp/
│   │   ├── server.ts             # Tool-Registry
│   │   └── tools/                # Ein File pro Tool
│   ├── engine/
│   │   ├── bootstrap.ts          # Basis-Template per @cesdk/node erzeugen
│   │   └── renderer.ts           # Template laden → fillen → PNG export
│   ├── editor/
│   │   └── server.ts             # Lokaler Express-Server für Editor-UI + ZIP-API
│   └── storage/
│       ├── types.ts
│       └── templateManager.ts
├── editor-app/                   # Vite + React + @cesdk/cesdk-js
├── scripts/                      # Smoketests
├── templates/                    # Runtime: gespeicherte Templates
└── output/                       # Runtime: gerenderte PNGs
```

## Konfiguration (Umgebungsvariablen)

| Variable | Pflicht | Standard | Wo |
|---|---|---|---|
| `CESDK_LICENSE` | ja | – | Root `.env` |
| `VITE_CESDK_LICENSE` | ja (Editor) | – | `editor-app/.env` |
| `TEMPLATES_DIR` | nein | `./templates` | Root `.env` |
| `OUTPUT_DIR` | nein | `./output` | Root `.env` |
| `EDITOR_PORT` | nein | `3456` | Root `.env` |

## Entwicklung

```bash
# MCP-Server im Watch-Modus (tsx)
npm run dev

# Editor-App im Vite-Dev-Modus (separat, mit Proxy auf Port 3456)
npm run dev:editor

# Type-Check ohne Build
npm run typecheck
```

## Bekannte Einschränkungen

- **Lizenz-Validierung beim Start.** `CreativeEngine.init()` validiert den Lizenzschlüssel einmalig
  gegen `api.img.ly`. Das erfordert beim ersten Aufruf eine Internetverbindung. Alle Folge-Operationen
  laufen lokal.
- **Editor-App muss vor `setup_template` gebaut sein** (`npm run build:editor`). Falls nicht, liefert
  der Editor-Server eine 503 mit Hinweis statt der App aus.
- **Kein Multi-Page-Support.** Templates haben aktuell genau eine Page (= ein Output-PNG pro Render).
- **Variablen-Erkennung beim `confirm_template`** basiert auf den im Editor genutzten `{{name}}`-Patterns.
  Wenn der Nutzer Variablen-Texte komplett ersetzt, kann die Liste leer ausfallen — fallback ist die
  ursprüngliche Variablen-Liste aus dem Bootstrap.
