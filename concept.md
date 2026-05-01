# Fachkonzept: CE.SDK Social Media Skill als MCP Server

**Version:** 1.0  
**Technologie-Stack:** TypeScript, Node.js, React/Next.js, CE.SDK (`@cesdk/node`, `@cesdk/cesdk-js`), MCP SDK  
**Paket-Typ:** Eigenständiges npm-Package (separates Repository)

---

## 1. Überblick & Zielsetzung

Der Skill ermöglicht es einem KI-Agenten (z. B. Claude Code / OpenClaw), eigenständig Social-Media-Bilder in einem konsistenten visuellen Stil zu generieren. Der Stil wird durch eine vom Nutzer erstellte Editor-Szene (Template) definiert. Der Agent befüllt das Template mit KI-generiertem Text und Bild und exportiert es als PNG.

Der Skill besteht aus zwei Subsystemen:

1. **MCP Server** – stellt dem Agenten Tools zur Verfügung (Template-Setup, Rendering, Verwaltung)
2. **Template-Editor** – lokaler Next.js-Webserver mit eingebettetem CE.SDK Browser-Editor; der Nutzer gestaltet und speichert sein Template darüber

Alle Daten (Templates, Metadaten, Output-Bilder) werden **lokal auf dem Rechner** gespeichert. Die einzige externe Abhängigkeit ist die einmalige Lizenz-Validierung von CE.SDK beim Start (`api.img.ly`).

---

## 2. Technologie-Entscheidungen

| Komponente | Technologie | Begründung |
|---|---|---|
| MCP Server | `@modelcontextprotocol/sdk` | Standard-Protokoll für Agenten-Tool-Integration |
| Headless Rendering | `@cesdk/node` | Offizielle Node.js Engine, kein Browser nötig |
| Template-Editor UI | `@cesdk/cesdk-js` (React) | Browser-basierter visueller Editor |
| Editor-Server | Next.js (App Router) | React-Framework, einfaches lokales Setup |
| Sprache | TypeScript (strict) | Typsicherheit, bessere DX |
| Template-Storage | Lokales Dateisystem | Keine externe Datenbank nötig |
| Metadaten | JSON-Dateien | Einfach, menschenlesbar, kein ORM nötig |

---

## 3. Paketstruktur

```
cesdk-social-skill/
│
├── package.json                  # npm-Package-Definition
├── tsconfig.json
├── .env.example                  # CESDK_LICENSE=...
├── README.md
│
├── src/
│   ├── index.ts                  # Einstiegspunkt: startet MCP Server
│   │
│   ├── mcp/
│   │   ├── server.ts             # MCP Server-Instanz & Tool-Registrierung
│   │   └── tools/
│   │       ├── setupTemplate.ts  # Tool: setup_template
│   │       ├── confirmTemplate.ts# Tool: confirm_template
│   │       ├── listTemplates.ts  # Tool: list_templates
│   │       ├── renderPost.ts     # Tool: render_post
│   │       └── deleteTemplate.ts # Tool: delete_template
│   │
│   ├── engine/
│   │   ├── bootstrap.ts          # Basis-Template per @cesdk/node generieren
│   │   └── renderer.ts           # Headless Rendering: Template → PNG
│   │
│   ├── editor/
│   │   └── server.ts             # Next.js-Prozess starten/stoppen
│   │
│   └── storage/
│       ├── templateManager.ts    # Template-CRUD auf Dateisystem
│       └── types.ts              # Shared TypeScript-Typen
│
├── editor-app/                   # Next.js App (Template-Editor UI)
│   ├── package.json
│   ├── next.config.ts
│   └── app/
│       ├── page.tsx              # Editor-Hauptseite
│       ├── api/
│       │   ├── template/
│       │   │   ├── [id]/
│       │   │   │   └── route.ts  # GET: Template-ZIP laden
│       │   │   └── route.ts      # POST: Template speichern
│       │   └── templates/
│       │       └── route.ts      # GET: Template-Liste
│       └── components/
│           └── CesdkEditor.tsx   # CE.SDK React-Komponente
│
├── templates/                    # Lokaler Template-Speicher (runtime)
│   └── [templateId]/
│       ├── template.zip          # CE.SDK Archiv (alle Assets eingebettet)
│       └── metadata.json         # Metadaten
│
└── output/                       # Generierte Bilder (runtime)
    └── [templateId]_[timestamp].png
```

---

## 4. Datenmodelle

### 4.1 TemplateMetadata (`metadata.json`)

```typescript
// src/storage/types.ts

export type TemplateStatus = 'draft' | 'ready';

export type SocialPlatform =
  | 'facebook'
  | 'instagram_square'
  | 'instagram_story'
  | 'instagram_landscape'
  | 'linkedin'
  | 'twitter';

export interface TemplateMetadata {
  id: string;                    // Slug, z. B. "herbst-kampagne"
  name: string;                  // Anzeigename
  description: string;           // Kurzbeschreibung
  platform: SocialPlatform;      // Ziel-Plattform
  dimensions: {
    width: number;               // Pixel
    height: number;              // Pixel
  };
  variables: string[];           // z. B. ["headline", "postText"]
  placeholders: string[];        // Block-Namen, z. B. ["main-image"]
  status: TemplateStatus;        // "draft" bis Nutzer bestätigt, dann "ready"
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### 4.2 Plattform-Dimensionen (Konstanten)

```typescript
// src/storage/types.ts

export const PLATFORM_DIMENSIONS: Record<SocialPlatform, { width: number; height: number }> = {
  facebook:             { width: 1200, height: 630 },
  instagram_square:     { width: 1080, height: 1080 },
  instagram_story:      { width: 1080, height: 1920 },
  instagram_landscape:  { width: 1080, height: 566 },
  linkedin:             { width: 1200, height: 627 },
  twitter:              { width: 1600, height: 900 },
};
```

### 4.3 RenderJob

```typescript
export interface RenderJob {
  templateId: string;
  variables: Record<string, string>;  // Schlüssel müssen mit metadata.variables übereinstimmen
  imagePath: string;                   // Lokaler Pfad zum Quellbild (file:// kompatibel)
}

export interface RenderResult {
  outputPath: string;   // Absoluter lokaler Pfad zur generierten PNG-Datei
  templateId: string;
  renderedAt: string;   // ISO 8601
}
```

---

## 5. MCP Server

### 5.1 Transport & Konfiguration

```typescript
// src/mcp/server.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'cesdk-social-skill',
  version: '1.0.0',
});

// Tools registrieren (siehe Abschnitt 5.2)
// ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

Der MCP Server kommuniziert über **stdio** – das ist der Standard für lokale MCP Server und erfordert keine Netzwerk-Konfiguration.

### 5.2 Tool-Definitionen

#### Tool 1: `setup_template`

Startet den Template-Setup-Workflow. Der Agent fragt den Nutzer nach Name, Beschreibung und Ziel-Plattform, generiert dann per `@cesdk/node` ein strukturiertes Basis-Template und startet den Editor-Server.

**Input Schema:**
```typescript
{
  name: string;           // Template-Name, z. B. "Herbst-Kampagne"
  description: string;    // Kurze Beschreibung des Verwendungszwecks
  platform: SocialPlatform;
  variables: string[];    // Vom Nutzer gewünschte Text-Variablen
                          // z. B. ["headline", "postText"]
}
```

**Ablauf im Tool-Handler:**
1. Template-ID aus `name` generieren (slug, z. B. `herbst-kampagne`)
2. Prüfen ob ID bereits existiert → Fehler wenn ja
3. `bootstrap.createBaseTemplate()` aufrufen (→ Abschnitt 7)
4. `editorServer.start()` aufrufen (→ Abschnitt 8)
5. Metadaten mit `status: 'draft'` speichern

**Output:**
```typescript
{
  templateId: string;
  editorUrl: string;    // z. B. "http://localhost:3456?template=herbst-kampagne"
  message: string;      // Erläuternder Text für den Agenten
}
```

---

#### Tool 2: `confirm_template`

Wird aufgerufen, nachdem der Nutzer dem Agenten mitteilt, dass das Template fertig ist. Verifiziert das gespeicherte Template und setzt den Status auf `ready`.

**Input Schema:**
```typescript
{
  templateId: string;
}
```

**Ablauf im Tool-Handler:**
1. Prüfen ob `template.zip` existiert
2. CE.SDK Node-Engine initialisieren
3. Template laden: `engine.scene.loadFromArchiveURL(file://...)`
4. Variablen aus Template auslesen: `engine.variable.findAll()`
5. Platzhalter aus Template auslesen: `engine.block.findAllPlaceholders()`
6. `metadata.json` aktualisieren: `status: 'ready'`, Variablen-Liste aktualisieren
7. Engine disposen

**Output:**
```typescript
{
  templateId: string;
  variables: string[];
  placeholderCount: number;
  status: 'ready';
}
```

---

#### Tool 3: `list_templates`

Listet alle gespeicherten Templates auf.

**Input Schema:** `{}` (keine Parameter)

**Ablauf:** Alle `metadata.json`-Dateien im `templates/`-Verzeichnis lesen und aggregieren.

**Output:**
```typescript
{
  templates: TemplateMetadata[];
  count: number;
}
```

---

#### Tool 4: `render_post`

Kernfunktion: Lädt ein Template, befüllt es mit KI-generiertem Inhalt und exportiert als PNG.

**Input Schema:**
```typescript
{
  templateId: string;
  variables: Record<string, string>;  // z. B. { "headline": "...", "postText": "..." }
  imagePath: string;                   // Lokaler Pfad zum Quellbild
}
```

**Ablauf im Tool-Handler:**
1. Template-Metadaten lesen, prüfen ob `status === 'ready'`
2. Prüfen ob alle deklarierten `metadata.variables` in `variables` vorhanden
3. Prüfen ob `imagePath` existiert (lokale Datei)
4. `renderer.renderPost()` aufrufen (→ Abschnitt 9)
5. Output-Pfad zurückgeben

**Output:**
```typescript
{
  outputPath: string;   // Absoluter Pfad zur generierten PNG-Datei
  renderedAt: string;
}
```

**Fehlerbehandlung:**
- Template nicht gefunden → klare Fehlermeldung mit verfügbaren Template-IDs
- Template hat Status `draft` → Hinweis: Nutzer muss erst im Editor speichern und `confirm_template` aufrufen
- Variable fehlt → Liste der fehlenden Variablen
- Bild-Datei nicht gefunden → Fehlermeldung mit erwartetem Pfad

---

#### Tool 5: `delete_template`

Löscht ein Template vollständig (ZIP + Metadaten).

**Input Schema:**
```typescript
{
  templateId: string;
  confirm: boolean;   // Sicherheitscheck: muss true sein
}
```

---

## 6. Storage-Modul

```typescript
// src/storage/templateManager.ts

import fs from 'fs';
import path from 'path';
import { TemplateMetadata } from './types.js';

const TEMPLATES_DIR = path.resolve(process.env.TEMPLATES_DIR ?? './templates');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR ?? './output');

export function getTemplatePath(id: string) {
  return {
    dir: path.join(TEMPLATES_DIR, id),
    zip: path.join(TEMPLATES_DIR, id, 'template.zip'),
    meta: path.join(TEMPLATES_DIR, id, 'metadata.json'),
    fileUrl: `file://${path.join(TEMPLATES_DIR, id, 'template.zip')}`,
  };
}

export function saveTemplateArchive(id: string, data: Buffer): void {
  const { dir, zip } = getTemplatePath(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(zip, data);
}

export function saveMetadata(meta: TemplateMetadata): void {
  const { dir, meta: metaPath } = getTemplatePath(meta.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export function loadMetadata(id: string): TemplateMetadata {
  const { meta } = getTemplatePath(id);
  if (!fs.existsSync(meta)) throw new Error(`Template '${id}' nicht gefunden`);
  return JSON.parse(fs.readFileSync(meta, 'utf-8'));
}

export function listTemplates(): TemplateMetadata[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(d => fs.existsSync(path.join(TEMPLATES_DIR, d, 'metadata.json')))
    .map(d => loadMetadata(d));
}

export function templateExists(id: string): boolean {
  return fs.existsSync(getTemplatePath(id).zip);
}

export function getOutputPath(templateId: string): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(OUTPUT_DIR, `${templateId}_${ts}.png`);
}
```

---

## 7. Engine Bootstrap-Modul

Erzeugt per `@cesdk/node` ein strukturiertes Basis-Template ohne Browser. Das Template definiert bereits die korrekte Szene-Größe, die Platzhalter und Text-Variablen-Blöcke – der Nutzer verfeinert dann nur noch das visuelle Design im Editor.

```typescript
// src/engine/bootstrap.ts

import CreativeEngine from '@cesdk/node';
import { pathToFileURL } from 'url';
import path from 'path';
import { PLATFORM_DIMENSIONS, SocialPlatform } from '../storage/types.js';
import { getTemplatePath, saveTemplateArchive, saveMetadata } from '../storage/templateManager.js';

const FONT_BOLD =
  'https://cdn.img.ly/packages/imgly/cesdk-js/latest/assets/extensions/ly.img.cesdk.fonts/fonts/Roboto/Roboto-Bold.ttf';
const FONT_REGULAR =
  'https://cdn.img.ly/packages/imgly/cesdk-js/latest/assets/extensions/ly.img.cesdk.fonts/fonts/Roboto/Roboto-Regular.ttf';

export interface BootstrapConfig {
  templateId: string;
  name: string;
  description: string;
  platform: SocialPlatform;
  variables: string[];            // z. B. ["headline", "postText"]
  imagePlaceholderName: string;   // Standard: "main-image"
}

export async function createBaseTemplate(config: BootstrapConfig): Promise<void> {
  const { width, height } = PLATFORM_DIMENSIONS[config.platform];
  const PADDING = 40;
  const CONTENT_WIDTH = width - PADDING * 2;
  const IMAGE_HEIGHT = Math.round(height * 0.6);

  const engine = await CreativeEngine.init({
    license: process.env.CESDK_LICENSE,
    baseURL: pathToFileURL(
      path.resolve(`./cesdk-assets/${CreativeEngine.version}`)
    ).href + '/',
  });

  try {
    // Szene erstellen
    engine.scene.create('Free', {
      page: { size: { width, height } },
    });
    engine.scene.setDesignUnit('Pixel');
    const page = engine.block.findByType('page')[0];

    // --- Bild-Platzhalter (oben, 60% der Höhe) ---
    const imageBlock = engine.block.create('graphic');
    const imageShape = engine.block.createShape('rect');
    engine.block.setShape(imageBlock, imageShape);
    const imageFill = engine.block.createFill('image');
    // Platzhalter-Bild: neutrales Grau
    engine.block.setString(imageFill, 'fill/image/imageFileURI', '');
    engine.block.setFill(imageBlock, imageFill);
    engine.block.setName(imageBlock, config.imagePlaceholderName);
    engine.block.setWidth(imageBlock, width);
    engine.block.setHeight(imageBlock, IMAGE_HEIGHT);
    engine.block.setPositionX(imageBlock, 0);
    engine.block.setPositionY(imageBlock, 0);
    // Placeholder-Verhalten aktivieren
    engine.block.setPlaceholderEnabled(imageBlock, true);
    if (engine.block.supportsPlaceholderBehavior(imageFill)) {
      engine.block.setPlaceholderBehaviorEnabled(imageFill, true);
    }
    engine.block.setPlaceholderControlsOverlayEnabled(imageBlock, true);
    engine.block.setPlaceholderControlsButtonEnabled(imageBlock, true);
    engine.block.appendChild(page, imageBlock);

    // --- Text-Blöcke für jede Variable ---
    const textAreaHeight = height - IMAGE_HEIGHT - PADDING;
    const blockHeight = Math.floor(textAreaHeight / config.variables.length);

    config.variables.forEach((varName, i) => {
      const isFirst = i === 0;
      const textBlock = engine.block.create('text');
      engine.block.replaceText(textBlock, `{{${varName}}}`);
      engine.block.setFont(textBlock, isFirst ? FONT_BOLD : FONT_REGULAR, {
        name: 'Roboto',
        fonts: [{
          uri: isFirst ? FONT_BOLD : FONT_REGULAR,
          subFamily: isFirst ? 'Bold' : 'Regular',
          weight: isFirst ? 'bold' : 'normal',
        }],
      });
      engine.block.setFloat(textBlock, 'text/fontSize', isFirst ? 28 : 16);
      engine.block.setWidthMode(textBlock, 'Absolute');
      engine.block.setHeightMode(textBlock, 'Auto');
      engine.block.setWidth(textBlock, CONTENT_WIDTH);
      engine.block.setPositionX(textBlock, PADDING);
      engine.block.setPositionY(textBlock, IMAGE_HEIGHT + PADDING + i * blockHeight);
      engine.block.setEnum(textBlock, 'text/horizontalAlignment', 'Left');
      engine.block.appendChild(page, textBlock);
      // Standard-Wert für Vorschau im Editor
      engine.variable.setString(varName, `[${varName}]`);
    });

    // --- Constraints: Positionen sperren, Fill-Austausch erlauben ---
    engine.editor.setGlobalScope('layer/move', 'Defer');
    engine.editor.setGlobalScope('layer/resize', 'Defer');
    engine.block.setScopeEnabled(imageBlock, 'layer/move', false);
    engine.block.setScopeEnabled(imageBlock, 'layer/resize', false);
    engine.block.setScopeEnabled(imageBlock, 'fill/change', true);

    // --- Als ZIP speichern ---
    const archive = await engine.scene.saveToArchive();
    const buffer = Buffer.from(await archive.arrayBuffer());
    saveTemplateArchive(config.templateId, buffer);

    // --- Metadaten speichern ---
    saveMetadata({
      id: config.templateId,
      name: config.name,
      description: config.description,
      platform: config.platform,
      dimensions: { width, height },
      variables: config.variables,
      placeholders: [config.imagePlaceholderName],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

  } finally {
    engine.dispose();
  }
}
```

---

## 8. Template-Editor (Next.js App)

Der Editor ist eine eigenständige Next.js-App im Unterordner `editor-app/`. Der MCP-Skill-Prozess startet und stoppt diese App als Child-Prozess.

### 8.1 Editor-Server-Steuerung

```typescript
// src/editor/server.ts

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let editorProcess: ChildProcess | null = null;
const EDITOR_PORT = parseInt(process.env.EDITOR_PORT ?? '3456');
const EDITOR_APP_DIR = path.resolve('./editor-app');

export async function startEditorServer(): Promise<string> {
  if (editorProcess) return `http://localhost:${EDITOR_PORT}`;

  editorProcess = spawn('npx', ['next', 'dev', '--port', String(EDITOR_PORT)], {
    cwd: EDITOR_APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEMPLATES_DIR: path.resolve('./templates'),
    },
  });

  // Kurz warten bis Server bereit ist
  await new Promise(resolve => setTimeout(resolve, 3000));
  return `http://localhost:${EDITOR_PORT}`;
}

export function stopEditorServer(): void {
  editorProcess?.kill();
  editorProcess = null;
}
```

### 8.2 CE.SDK React-Komponente

```typescript
// editor-app/app/components/CesdkEditor.tsx
'use client';

import { useEffect, useRef } from 'react';
import CreativeEditorSDK from '@cesdk/cesdk-js';

interface Props {
  templateId: string;
  onSave: (archiveBase64: string) => void;
}

export default function CesdkEditor({ templateId, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cesdk: CreativeEditorSDK | null = null;

    CreativeEditorSDK.create(containerRef.current, {
      license: process.env.NEXT_PUBLIC_CESDK_LICENSE!,
      role: 'Creator',
      theme: 'dark',
    }).then(async (instance) => {
      cesdk = instance;
      const engine = instance.engine;

      // Bestehendes Template laden
      const res = await fetch(`/api/template/${templateId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await engine.scene.loadFromArchiveURL(url);
        URL.revokeObjectURL(url);
      }

      // "Speichern"-Button in Navigationsleiste registrieren
      instance.ui.registerComponent('save.template', ({ builder }) => {
        builder.Button('save-btn', {
          label: 'Template speichern',
          icon: '@imgly/Save',
          variant: 'regular',
          onClick: async () => {
            const archive = await engine.scene.saveToArchive();
            const buffer = await archive.arrayBuffer();
            const base64 = btoa(
              String.fromCharCode(...new Uint8Array(buffer))
            );
            onSave(base64);
          },
        });
      });

      instance.ui.insertOrderComponent(
        { in: 'ly.img.navigation.bar', position: 'end' },
        'save.template'
      );
    });

    return () => { cesdk?.destroy(); };
  }, [templateId, onSave]);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
}
```

### 8.3 API Route: Template speichern

```typescript
// editor-app/app/api/template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? './templates';

export async function POST(req: NextRequest) {
  const { templateId, archiveBase64 } = await req.json();

  const dir = path.join(TEMPLATES_DIR, templateId);
  const zipPath = path.join(dir, 'template.zip');

  fs.mkdirSync(dir, { recursive: true });
  const buffer = Buffer.from(archiveBase64, 'base64');
  fs.writeFileSync(zipPath, buffer);

  // metadata.json: updatedAt aktualisieren
  const metaPath = path.join(dir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return NextResponse.json({ success: true });
}
```

### 8.4 API Route: Template laden

```typescript
// editor-app/app/api/template/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? './templates';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const zipPath = path.join(TEMPLATES_DIR, params.id, 'template.zip');
  if (!fs.existsSync(zipPath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const data = fs.readFileSync(zipPath);
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/zip' },
  });
}
```

---

## 9. Renderer-Modul

```typescript
// src/engine/renderer.ts

import CreativeEngine from '@cesdk/node';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { RenderJob, RenderResult } from '../storage/types.js';
import { getTemplatePath, loadMetadata, getOutputPath } from '../storage/templateManager.js';

export async function renderPost(job: RenderJob): Promise<RenderResult> {
  const meta = loadMetadata(job.templateId);
  if (meta.status !== 'ready') {
    throw new Error(
      `Template '${job.templateId}' hat Status '${meta.status}'. ` +
      `Bitte zuerst im Editor speichern und confirm_template aufrufen.`
    );
  }

  // Alle deklarierten Variablen müssen vorhanden sein
  const missing = meta.variables.filter(v => !(v in job.variables));
  if (missing.length > 0) {
    throw new Error(`Fehlende Variablen: ${missing.join(', ')}`);
  }

  // Quellbild muss existieren
  const absImagePath = path.resolve(job.imagePath);
  if (!fs.existsSync(absImagePath)) {
    throw new Error(`Bild nicht gefunden: ${absImagePath}`);
  }

  const engine = await CreativeEngine.init({
    license: process.env.CESDK_LICENSE,
    baseURL: pathToFileURL(
      path.resolve(`./cesdk-assets/${CreativeEngine.version}`)
    ).href + '/',
  });

  try {
    const { fileUrl } = getTemplatePath(job.templateId);
    await engine.scene.loadFromArchiveURL(fileUrl);

    // Text-Variablen setzen
    for (const [key, value] of Object.entries(job.variables)) {
      engine.variable.setString(key, value);
    }

    // Bild in Platzhalter einsetzen
    const placeholderName = meta.placeholders[0];
    const [imageBlock] = engine.block.findByName(placeholderName);
    if (imageBlock != null) {
      const fill = engine.block.getFill(imageBlock);
      engine.block.setString(
        fill,
        'fill/image/imageFileURI',
        pathToFileURL(absImagePath).href
      );
    }

    // Exportieren
    const [page] = engine.block.findByType('page');
    const blob = await engine.block.export(page, {
      mimeType: 'image/png',
      targetWidth: meta.dimensions.width,
      targetHeight: meta.dimensions.height,
    });

    const buffer = Buffer.from(await blob.arrayBuffer());
    const outputPath = getOutputPath(job.templateId);
    fs.writeFileSync(outputPath, buffer);

    return {
      outputPath,
      templateId: job.templateId,
      renderedAt: new Date().toISOString(),
    };

  } finally {
    engine.dispose();
  }
}
```

---

## 10. Vollständiger Workflow (Sequenzdiagramm)

```
Nutzer              Agent (MCP)             MCP Skill              Dateisystem
  │                     │                       │                       │
  │ "Neues Template"    │                       │                       │
  │────────────────────>│                       │                       │
  │                     │ setup_template(...)   │                       │
  │                     │──────────────────────>│                       │
  │                     │                       │ createBaseTemplate()  │
  │                     │                       │──────────────────────>│
  │                     │                       │ templates/id/         │
  │                     │                       │ template.zip          │
  │                     │                       │ metadata.json(draft)  │
  │                     │                       │<──────────────────────│
  │                     │                       │ startEditorServer()   │
  │                     │                       │─────────┐             │
  │                     │                       │ Next.js │             │
  │                     │                       │<────────┘             │
  │                     │ { editorUrl }         │                       │
  │                     │<──────────────────────│                       │
  │ "Öffne localhost:   │                       │                       │
  │  3456"              │                       │                       │
  │<────────────────────│                       │                       │
  │                     │                       │                       │
  │ [Browser: Template  │                       │                       │
  │  visuell bearbeiten]│                       │                       │
  │                     │                       │                       │
  │ [Klick: Speichern]──┼───────────────────────┼──POST /api/template──>│
  │                     │                       │                       │ template.zip
  │                     │                       │                       │ (aktualisiert)
  │                     │                       │                       │
  │ "Fertig"            │                       │                       │
  │────────────────────>│                       │                       │
  │                     │ confirm_template(id)  │                       │
  │                     │──────────────────────>│                       │
  │                     │                       │ loadFromArchiveURL()  │
  │                     │                       │ variable.findAll()    │
  │                     │                       │ metadata(ready)──────>│
  │                     │ { variables, status } │                       │
  │                     │<──────────────────────│                       │
  │ "Template bereit.   │                       │                       │
  │  Variablen: ..."    │                       │                       │
  │<────────────────────│                       │                       │
  │                     │                       │                       │
  │ "Post erstellen"    │                       │                       │
  │────────────────────>│                       │                       │
  │                     │ render_post(...)      │                       │
  │                     │──────────────────────>│                       │
  │                     │                       │ renderPost()          │
  │                     │                       │ loadFromArchiveURL()  │
  │                     │                       │ variable.setString()  │
  │                     │                       │ block.export()        │
  │                     │                       │ output/post.png──────>│
  │                     │ { outputPath }        │                       │
  │                     │<──────────────────────│                       │
  │ "Bild gespeichert   │                       │                       │
  │  unter: ..."        │                       │                       │
  │<────────────────────│                       │                       │
```

---

## 11. Konfiguration & Umgebungsvariablen

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `CESDK_LICENSE` | ✅ | – | CE.SDK Lizenzschlüssel |
| `TEMPLATES_DIR` | ❌ | `./templates` | Ablagepfad für Templates |
| `OUTPUT_DIR` | ❌ | `./output` | Ablagepfad für generierte Bilder |
| `EDITOR_PORT` | ❌ | `3456` | Port des lokalen Editor-Servers |
| `NEXT_PUBLIC_CESDK_LICENSE` | ✅ (Editor) | – | CE.SDK Lizenz für Browser-Editor |

`.env.example`:
```
CESDK_LICENSE=your_license_key_here
NEXT_PUBLIC_CESDK_LICENSE=your_license_key_here
TEMPLATES_DIR=./templates
OUTPUT_DIR=./output
EDITOR_PORT=3456
```

---

## 12. package.json (Root)

```json
{
  "name": "cesdk-social-skill",
  "version": "1.0.0",
  "description": "MCP Skill für KI-gestützte Social-Media-Bildgenerierung mit CE.SDK",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && cd editor-app && npm run build",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "install:all": "npm install && cd editor-app && npm install"
  },
  "dependencies": {
    "@cesdk/node": "^1.73.1",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

```json
// editor-app/package.json
{
  "name": "cesdk-social-skill-editor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@cesdk/cesdk-js": "^1.73.1",
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0"
  }
}
```

---

## 13. MCP-Konfiguration für den Agenten

Um den Skill in einem MCP-kompatiblen Agenten zu registrieren, fügt der Nutzer folgendes zur MCP-Konfigurationsdatei des Agenten hinzu (z. B. `~/.cursor/mcp.json` oder `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cesdk-social-skill": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absoluter/pfad/zum/skill",
      "env": {
        "CESDK_LICENSE": "your_license_key_here"
      }
    }
  }
}
```

---

## 14. Bekannte Einschränkung

**Lizenz-Validierung beim Start:** `CreativeEngine.init()` validiert den Lizenzschlüssel einmalig gegen `api.img.ly` beim ersten Aufruf. Das erfordert eine Internetverbindung. Alle nachfolgenden Operationen (Rendern, Exportieren, Template laden) laufen vollständig lokal. Dies betrifft sowohl `@cesdk/node` (Rendering) als auch `@cesdk/cesdk-js` (Browser-Editor).

---

## 15. Installations-Checkliste für Claude Code

1. Repository initialisieren (`git init`, `package.json` anlegen)
2. Root-Abhängigkeiten installieren: `npm install`
3. `editor-app/` als Next.js-Projekt initialisieren: `cd editor-app && npx create-next-app@latest . --typescript --app`
4. Editor-App-Abhängigkeiten installieren: `npm install @cesdk/cesdk-js`
5. `tsconfig.json` konfigurieren (ESM, `moduleResolution: bundler`)
6. Alle Module implementieren in der Reihenfolge:
   - `src/storage/types.ts`
   - `src/storage/templateManager.ts`
   - `src/engine/bootstrap.ts`
   - `src/engine/renderer.ts`
   - `src/editor/server.ts`
   - `src/mcp/tools/*.ts` (je Tool eine Datei)
   - `src/mcp/server.ts`
   - `src/index.ts`
   - `editor-app/app/components/CesdkEditor.tsx`
   - `editor-app/app/api/template/route.ts`
   - `editor-app/app/api/template/[id]/route.ts`
   - `editor-app/app/page.tsx`
7. `.env` aus `.env.example` erstellen und Lizenzschlüssel eintragen
8. Build testen: `npm run dev`
9. MCP-Konfiguration in Agenten-Config eintragen

---

*Dokument erstellt auf Basis der CE.SDK-Dokumentation v1.73.1 und der gemeinsamen Konzeptentwicklung.*