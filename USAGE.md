# Nutzung des cesdk-social-skill

Dieser Skill ist ein **lokaler MCP-Server (stdio)**. Jeder MCP-fähige Agent kann ihn registrieren —
dieser Leitfaden zeigt das konkret für [Claude Code](#claude-code) und [OpenClaw](#openclaw).

## Voraussetzungen (einmalig pro Maschine)

```bash
cd /pfad/zu/cesdk-social-skill

# Einmalig: Abhängigkeiten installieren und Editor-App bauen
npm run install:all
cp .env.example .env
cp editor-app/.env.example editor-app/.env
# In beiden .env-Dateien CESDK_LICENSE bzw. VITE_CESDK_LICENSE eintragen
npm run build
```

Nach `npm run build` existieren `dist/index.js` (MCP-Server) und `editor-app/dist/index.html`
(Browser-Editor). Beides braucht der Skill zur Laufzeit.

Den absoluten Pfad zum Projekt notieren — er wird gleich bei der Agent-Konfiguration gebraucht:

```bash
pwd
# → /Users/dein-name/.../cesdk-social-skill
```

---

## Claude Code

### Installation

In Claude Code gibt es zwei Möglichkeiten, einen MCP-Server zu registrieren.

#### Option A: Per CLI (empfohlen)

```bash
claude mcp add cesdk-social-skill \
  --scope user \
  --env CESDK_LICENSE=dein_lizenzschluessel \
  -- node /absoluter/pfad/zu/cesdk-social-skill/dist/index.js
```

Erklärung der Flags:
- `--scope user` → speichert in `~/.claude.json`, ist also überall verfügbar.
  Alternativen: `--scope project` (im aktuellen Repo) oder `--scope local` (nur diese Sitzung).
- `--env KEY=VALUE` → setzt Umgebungsvariablen für den Server-Prozess.
- Alles nach `--` ist der Befehl, mit dem der MCP-Server gestartet wird.

#### Option B: Manuell in `~/.claude.json`

```json
{
  "mcpServers": {
    "cesdk-social-skill": {
      "command": "node",
      "args": ["/absoluter/pfad/zu/cesdk-social-skill/dist/index.js"],
      "env": {
        "CESDK_LICENSE": "dein_lizenzschluessel"
      }
    }
  }
}
```

### Verifikation

```bash
# Im Projekt oder in einem beliebigen Verzeichnis
claude

# In der Claude-Code-Session:
/mcp
```

Du solltest `cesdk-social-skill` mit Status `connected` und 5 Tools sehen
(`setup_template`, `confirm_template`, `list_templates`, `render_post`, `delete_template`).

### Beispiel-Prompts

Direkt in Claude Code formulieren — der Agent ruft die richtigen Tools selbst auf.

**Template anlegen:**
> Lege ein neues Instagram-Quadrat-Template an mit dem Namen "Herbst-Kampagne" und den
> Variablen "headline" und "postText". Beschreibung: "Saisonale Aktion für unseren Webshop."

Claude Code wird `setup_template` aufrufen und dir die Editor-URL nennen, z. B.
`http://localhost:3456?template=herbst-kampagne`. Die öffnest du im Browser, machst dein
Design fertig und klickst oben rechts auf **Template speichern**.

**Template bestätigen:**
> Ich habe das Template fertig im Editor gespeichert. Bitte als bereit markieren.

→ ruft `confirm_template`.

**Posts rendern (z. B. mehrere in Folge):**
> Generiere 3 Posts für die Herbst-Kampagne. Themen: Apfelernte, Kürbissuppe, warmer Kakao.
> Verwende das Bild ~/Bilder/herbst.jpg für alle drei. Schreibe für jeden eine kurze, knackige
> Headline und einen Body-Text in maximal zwei Sätzen.

→ Claude Code formuliert pro Post `headline` + `postText` und ruft `render_post` dreimal
auf. Outputs landen in `output/herbst-kampagne_<timestamp>.png`.

**Aufräumen:**
> Lösche das Template "test-template".

→ Claude Code ruft `delete_template` mit `confirm: true` auf, nachdem es bei dir nochmal
rückversichert hat.

### Hinweis zum ersten Editor-Aufruf

Der CE.SDK-Browser-Editor lädt beim ersten Mal Assets von img.lys CDN (Fonts, WASM, …).
Das kann 5–10 Sekunden dauern — das ist normal, kein Bug.

---

## OpenClaw

OpenClaw ist ein eigenständiges Open-Source-Agenten-Framework von Peter Steinberger und spricht
ebenfalls MCP. Weil OpenClaw sich noch schnell weiterentwickelt, sind die folgenden Schritte als
Skelett zu verstehen — die maßgebliche Quelle ist die offizielle Doku unter
[docs.openclaw.ai/cli/mcp](https://docs.openclaw.ai/cli/mcp).

### Erwartete Konfiguration

OpenClaw verwendet wie die meisten MCP-Clients eine `mcpServers`-Sektion in seiner
Konfigurationsdatei. Der Eintrag für unseren Skill ist identisch zu dem in Claude Code:

```json
{
  "mcpServers": {
    "cesdk-social-skill": {
      "command": "node",
      "args": ["/absoluter/pfad/zu/cesdk-social-skill/dist/index.js"],
      "env": {
        "CESDK_LICENSE": "dein_lizenzschluessel"
      }
    }
  }
}
```

Wo genau diese Konfiguration hingehört (und ob OpenClaw auch einen `claw mcp add`-CLI-Befehl
hat) — bitte in der oben verlinkten Doku nachschlagen. Der Skill selbst ist agnostisch:
solange OpenClaw einen stdio-basierten MCP-Server starten kann, funktioniert er.

### Verifikation

In OpenClaw nach dem Start nach den verfügbaren Skills/Tools fragen, z. B.:

> Welche MCP-Tools sind aktuell verfügbar?

Du solltest `setup_template`, `confirm_template`, `list_templates`, `render_post` und
`delete_template` sehen.

### Beispiel-Prompts

Die [Beispiel-Prompts aus dem Claude-Code-Abschnitt](#beispiel-prompts) funktionieren in
OpenClaw genauso — das Tool-Interface ist standardisiert, die Sprache am Frontend ändert
sich nicht.

---

## Typischer Ablauf (Schritt für Schritt)

```
1. [Agent]   "Lege ein Template an: ..."
   ↓
2. [Skill]   setup_template → erzeugt Bootstrap, startet Editor-Server
   ↓
3. [Agent]   "Öffne http://localhost:3456?template=... im Browser."
   ↓
4. [Du]      Browser öffnen → Design fertigstellen → Template speichern
   ↓
5. [Agent]   "Ist das Template fertig?"   "Ja."   confirm_template
   ↓
6. [Agent]   render_post (× n)            → output/<id>_<ts>.png pro Post
```

---

## Troubleshooting

| Symptom | Ursache | Lösung |
|---|---|---|
| `tools/list` zeigt nur 0 Tools | Server wurde nicht erfolgreich gestartet | Im Agent das MCP-Log einsehen (Claude Code: `/mcp` → `View logs`). Häufigste Ursache: falscher Pfad oder fehlendes `npm run build`. |
| `setup_template` gibt "CESDK_LICENSE ist nicht gesetzt" | ENV-Variable fehlt im MCP-Eintrag | `env`-Block in der MCP-Konfiguration prüfen, oder den Skill als Wrapper-Skript starten, das `.env` lädt. |
| Editor zeigt 503 mit "Editor-App ist noch nicht gebaut" | `editor-app/dist` fehlt | `npm run build:editor` ausführen, MCP-Server neu starten lassen. |
| `render_post` schlägt fehl: "Status 'draft'" | `confirm_template` wurde noch nicht aufgerufen | Im Editor speichern (POST an `/api/template/:id`), dann `confirm_template`. |
| Editor-Port 3456 belegt | Eine andere Anwendung blockiert ihn | `EDITOR_PORT` in der MCP-`env`-Sektion auf einen freien Port setzen. |
| Lange Wartezeit beim ersten Editor-Aufruf | CE.SDK lädt Assets vom CDN | Normal, einmalig pro Browser-Session. Im Browser-Devtools auf Network sichtbar. |

## Smoketests vorab

Falls du den Skill ohne Agent erst mal "trocken" testen willst:

```bash
npm run smoketest:bootstrap   # erzeugt ein Test-Template per @cesdk/node
npm run smoketest:render      # rendert ein Test-Bild → output/*.png
```

Beide Skripte sind unabhängig vom MCP-Layer und decken die kritischen Engine-Pfade ab.
