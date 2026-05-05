---
name: cesdk-social
description: Generiert Social-Media-Bilder (Instagram-, Facebook-, LinkedIn-, Twitter-Posts und -Stories) aus CE.SDK-Templates. Greift, wenn der Nutzer Posts in einem konsistenten visuellen Stil produzieren möchte — er gestaltet ein Template einmal in einem lokalen Browser-Editor, danach befüllt der Skill es per CLI mit Text und Bild und exportiert PNGs.
---

# cesdk-social — Social-Media-Posts aus CE.SDK-Templates

Dieses Repo enthält eine CLI (`cesdk-social`) plus einen lokalen Browser-Editor, mit dem ein Nutzer Templates einmalig gestaltet. Du befüllst sie anschließend mit Text und Bild und renderst PNGs.

---

## Wichtig: Lizenzschlüssel-Handling (Security)

Der CE.SDK-Lizenzschlüssel liegt in `.env` und `editor-app/.env`. Er ist sensibel.

**Niemals:**
- `.env` oder `editor-app/.env` mit dem Read-Tool öffnen.
- `cat .env`, `head .env`, `tail .env`, `grep CESDK .env`, `xxd .env`, `awk` o. Ä. auf diese Dateien anwenden.
- `env`, `printenv`, `echo $CESDK_LICENSE` o. Ä. ausführen.
- Den Schlüsselwert als Argument an irgendein Tool weitergeben.

**Wenn ein Befehl mit „CESDK_LICENSE ist nicht gesetzt" fehlschlägt:** Den Nutzer auffordern, seinen `.env`-Inhalt zu prüfen — die Datei nicht selbst inspizieren.

---

## Setup-Check (vor der ersten Nutzung pro Session)

Bevor du irgendeinen `cesdk-social`-Befehl absetzt, prüfe in dieser Reihenfolge:

1. **Build vorhanden?** Existieren `dist/cli/index.js` UND `editor-app/dist/index.html`? Falls nein:
   ```bash
   npm run install:all && npm run build
   ```

2. **`.env` vorhanden?** Existieren `.env` UND `editor-app/.env`? Falls nein:
   ```bash
   cp .env.example .env
   cp editor-app/.env.example editor-app/.env
   ```
   Danach **stop und sage dem Nutzer** wörtlich:
   > „Ich habe `.env` und `editor-app/.env` aus den Vorlagen erzeugt. Bitte öffne beide Dateien und trage deinen CE.SDK-Lizenzschlüssel ein (Variablen `CESDK_LICENSE` bzw. `VITE_CESDK_LICENSE`). Den Trial-Key gibt's unter https://img.ly/dashboard. Sag mir Bescheid, wenn du fertig bist."
   
   Auf seine Bestätigung warten, bevor du fortfährst.

---

## Workflow

> Hinweis zu den Befehlen: Du nutzt durchgehend `node dist/cli/index.js …`, weil `cesdk-social`
> nur nach einem manuellen `npm link` im PATH wäre. Mit `node dist/cli/index.js` läuft die CLI
> immer und ohne zusätzliche Setup-Schritte des Nutzers.

### Neues Template anlegen

```bash
node dist/cli/index.js init "<Anzeigename>" \
  --platform <platform> \
  --variables <var1,var2,...> \
  --description "<kurze Beschreibung>"
```

- **Plattformen:** `facebook`, `instagram_square`, `instagram_story`, `instagram_landscape`, `linkedin`, `twitter`
- **Variablen:** kommagetrennte Liste. Erste = Headline (bold), Rest = Body. Beispiel: `headline,postText`.

stdout enthält die `templateId` (slugifiziert aus dem Namen) und die spätere Editor-URL.

### Editor starten und Nutzer einbinden

Starte den Editor **als Hintergrundprozess** (Bash-Tool mit `run_in_background: true`):

```bash
node dist/cli/index.js editor
```

Lies aus dem Output die URL `http://localhost:3456` (oder den von dir mit `--port` gewählten Port).

Sage dem Nutzer:
> „Öffne http://localhost:3456?template=<id> im Browser, finalisiere das Design und klicke oben rechts auf **Template speichern**. Sag mir Bescheid, wenn du fertig bist."

Auf Bestätigung warten. Beim ersten Aufruf lädt CE.SDK Assets vom CDN — 5–10 s Wartezeit ist normal.

### Posts rendern

Sobald der Nutzer „fertig" sagt:

```bash
node dist/cli/index.js render <id> \
  --image <absoluter-bildpfad> \
  --vars '{"headline":"…","postText":"…"}'
```

Der absolute Pfad zur erzeugten PNG wird auf stdout ausgegeben (eine Zeile, sonst nichts). Standard-Output-Verzeichnis: `output/<id>_<timestamp>.png`. Mit `--output <pfad>` überschreibbar.

Für mehrere Posts: `render` einfach mehrfach aufrufen — jeder Aufruf erzeugt eine eigene PNG mit Zeitstempel.

### Editor stoppen

Wenn der Nutzer keine Render-Aufträge mehr hat: den Hintergrundprozess beenden (KillShell).

---

## Weitere Befehle

```bash
node dist/cli/index.js list              # menschenlesbare Tabelle
node dist/cli/index.js list --json       # für Programmverarbeitung
node dist/cli/index.js delete <id> --force
```

`delete` entfernt das Template-Archiv und die Metadaten; bereits gerenderte PNGs in `output/` bleiben erhalten.

---

## Variablen per JSON-Datei (für Batches)

Statt `--vars '{…}'` geht auch `--vars-file vars.json`. Praktisch für Schleifen mit unterschiedlichen Inhalten oder wenn der JSON-String zu lang/ungewöhnlich für die Shell ist.

```bash
node dist/cli/index.js render herbst-kampagne \
  --image ~/Bilder/apfel.jpg \
  --vars-file ./posts/post-01.json
```

---

## Häufige Fehler

| Fehler | Ursache | Reaktion |
|---|---|---|
| `CESDK_LICENSE ist nicht gesetzt` | Leere/fehlende `.env` | Nutzer auffordern, Key in `.env` einzutragen. **Datei nicht selbst lesen.** |
| `Editor-App ist noch nicht gebaut` | `editor-app/dist/` fehlt | `npm run build:editor` ausführen |
| `Template '…' nicht gefunden` | Falsche ID | `node dist/cli/index.js list` zur Korrektur |
| Port 3456 belegt | Anderer Prozess hält den Port | Mit `cesdk-social editor --port <anderer>` starten |
| `Template '…' existiert bereits` (bei `init`) | Slug-Kollision | Anderen Namen wählen oder altes Template via `delete --force` entfernen |

---

## Typische Sequenz (Beispiel)

1. Nutzer: „Lege ein Instagram-Quadrat-Template ‚Herbst-Kampagne' mit Headline und Body an."
2. Du: `node dist/cli/index.js init "Herbst-Kampagne" --platform instagram_square --variables headline,postText`
3. Du: `node dist/cli/index.js editor` (im Hintergrund) → URL extrahieren
4. Du zum Nutzer: „Öffne http://localhost:3456?template=herbst-kampagne, gestalte und speichere das Template. Sag mir Bescheid."
5. Nutzer: „Fertig."
6. Nutzer: „Generiere 3 Posts: Apfelernte, Kürbissuppe, warmer Kakao. Bild: ~/Bilder/herbst.jpg."
7. Du formulierst pro Post Headline + Body und rufst `render` 3× auf.
8. Du gibst dem Nutzer die 3 Output-Pfade.
9. Auf Wunsch: Editor-Prozess stoppen.
