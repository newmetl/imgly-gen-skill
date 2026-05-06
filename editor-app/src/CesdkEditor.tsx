import { useEffect, useRef, useState } from 'react';
import CreativeEditorSDK from '@cesdk/cesdk-js';
import {
  ColorPaletteAssetSource,
  TypefaceAssetSource,
} from '@cesdk/cesdk-js/plugins';

interface Props {
  templateId: string | null;
}

interface TemplateListEntry {
  id: string;
  name: string;
  platform: string;
}

const TEMPLATE_SOURCE_ID = 'cesdk-social.templates';
const TEMPLATE_LIBRARY_ENTRY_ID = 'cesdk-social.templates.entry';

async function loadTemplateIntoScene(
  engine: CreativeEditorSDK['engine'],
  templateId: string,
): Promise<void> {
  const res = await fetch(`/api/template/${encodeURIComponent(templateId)}`);
  if (!res.ok) {
    throw new Error(
      `Template '${templateId}' konnte nicht geladen werden (HTTP ${res.status}).`,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    await engine.scene.loadFromArchiveURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export function CesdkEditor({ templateId }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const cesdkRef = useRef<CreativeEditorSDK | null>(null);
  const currentTemplateIdRef = useRef<string | null>(templateId);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    templateId,
  );
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  // Beide Halter (State + Ref) synchron halten: State triggert Re-Renders
  // (Save-Button), Ref ist die stabile Quelle für async-Callbacks.
  const updateCurrentTemplateId = (next: string): void => {
    currentTemplateIdRef.current = next;
    setCurrentTemplateId(next);
    window.history.replaceState(
      {},
      '',
      `?template=${encodeURIComponent(next)}`,
    );
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Lizenz wird zur Laufzeit vom Editor-Server in `window.__CESDK_LICENSE__`
    // injiziert. Fallback auf VITE_CESDK_LICENSE nur für `vite dev` (Editor-App-
    // Entwicklung), wo der Server-Inject nicht greift.
    const license =
      window.__CESDK_LICENSE__ ?? import.meta.env.VITE_CESDK_LICENSE;
    if (!license) {
      setStatus({
        kind: 'error',
        message:
          'CESDK_LICENSE nicht gefunden. Bitte den Lizenz-Wizard ausführen oder in der Root-.env hinterlegen.',
      });
      return;
    }

    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const instance = await CreativeEditorSDK.create(container, {
          license,
          role: 'Creator',
          theme: 'dark',
        });
        if (cancelled) {
          instance.dispose();
          return;
        }
        cesdkRef.current = instance;
        const engine = instance.engine;

        await instance.addPlugin(new TypefaceAssetSource());
        await instance.addPlugin(new ColorPaletteAssetSource());

        instance.feature.enable([
          'ly.img.inspector.bar',
          'ly.img.text',
          'ly.img.text.edit',
          'ly.img.text.typeface',
          'ly.img.text.fontSize',
          'ly.img.text.fontStyle',
          'ly.img.text.alignment',
          'ly.img.fill',
          'ly.img.fill.color',
          'ly.img.dock',
          'ly.img.library.panel',
        ]);
        instance.ui.setComponentOrder({ in: 'ly.img.inspector.bar' }, [
          'ly.img.text.typeFace.inspectorBar',
          'ly.img.text.fontSize.inspectorBar',
          'ly.img.text.bold.inspectorBar',
          'ly.img.text.italic.inspectorBar',
          'ly.img.separator',
          'ly.img.text.alignHorizontal.inspectorBar',
          'ly.img.separator',
          'ly.img.fill.inspectorBar',
        ]);

        // Template-Library im Dock: Source + Library-Entry + Dock-Button.
        // Beim Klick auf einen Eintrag lädt applyAsset die Scene; der React-
        // State-Ref wird auf die neue ID umgestellt, damit "Speichern" ins
        // richtige Template schreibt.
        engine.asset.addLocalSource(
          TEMPLATE_SOURCE_ID,
          [],
          async (asset) => {
            await loadTemplateIntoScene(engine, asset.id);
            updateCurrentTemplateId(asset.id);
            setStatus({ kind: 'ready' });
            return undefined;
          },
        );

        const listRes = await fetch('/api/templates');
        if (listRes.ok) {
          const templates = (await listRes.json()) as TemplateListEntry[];
          // CE.SDK behandelt relative URIs als Asset-Pfade und prependet die
          // CDN-BaseURL. Absolute URLs nutzen, damit Thumbs vom eigenen Server
          // geladen werden statt von cdn.img.ly.
          const origin = window.location.origin;
          for (const t of templates) {
            engine.asset.addAssetToSource(TEMPLATE_SOURCE_ID, {
              id: t.id,
              label: { en: t.name, de: t.name },
              meta: {
                uri: `${origin}/api/template/${encodeURIComponent(t.id)}`,
                thumbUri: `${origin}/api/template/${encodeURIComponent(t.id)}/thumb`,
              },
            });
          }
        }

        instance.ui.addAssetLibraryEntry({
          id: TEMPLATE_LIBRARY_ENTRY_ID,
          sourceIds: [TEMPLATE_SOURCE_ID],
          gridColumns: 2,
        });

        instance.ui.insertOrderComponent(
          { in: 'ly.img.dock', position: 'start' },
          {
            id: 'ly.img.assetLibrary.dock',
            key: 'cesdk-social-templates',
            label: 'Templates',
            icon: '@imgly/Template',
            entries: [TEMPLATE_LIBRARY_ENTRY_ID],
          },
        );

        if (templateId) {
          await loadTemplateIntoScene(engine, templateId);
          updateCurrentTemplateId(templateId);
        } else {
          // Kein Template in der URL: leere Scene anlegen (sonst rendert CE.SDK
          // gar nichts) und Library-Panel direkt öffnen, damit der Nutzer ohne
          // Umweg eine Vorlage auswählen kann. Größe ist nur ein Platzhalter —
          // sie wird beim ersten applyAsset durch die Template-Scene ersetzt.
          engine.scene.create('Free', {
            page: { size: { width: 1080, height: 1080 } },
          });
          engine.scene.setDesignUnit('Pixel');
          instance.ui.openPanel('//ly.img.panel/assetLibrary', {
            payload: { entries: [TEMPLATE_LIBRARY_ENTRY_ID] },
          });
        }

        setStatus({ kind: 'ready' });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
      cesdkRef.current?.dispose();
      cesdkRef.current = null;
    };
  }, [templateId]);

  const onSave = async (): Promise<void> => {
    const instance = cesdkRef.current;
    if (!instance) return;
    const id = currentTemplateIdRef.current;
    if (!id) return;
    setStatus({ kind: 'saving' });
    try {
      const archive = await instance.engine.scene.saveToArchive();
      const buffer = await archive.arrayBuffer();
      const res = await fetch(
        `/api/template/${encodeURIComponent(id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/zip' },
          body: buffer,
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Speichern fehlgeschlagen (HTTP ${res.status}): ${body}`);
      }
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <SaveBar
        status={status}
        hasSelection={currentTemplateId !== null}
        onSave={() => void onSave()}
      />
    </div>
  );
}

function SaveBar({
  status,
  hasSelection,
  onSave,
}: {
  status: Status;
  hasSelection: boolean;
  onSave: () => void;
}): JSX.Element {
  const disabled =
    status.kind === 'loading' || status.kind === 'saving' || !hasSelection;
  const label =
    status.kind === 'saving'
      ? 'Speichere ...'
      : status.kind === 'loading'
        ? 'Lade ...'
        : !hasSelection
          ? 'Kein Template ausgewählt'
          : 'Template speichern';

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: 'rgba(20, 20, 20, 0.85)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <StatusBadge status={status} />
      <button
        type="button"
        disabled={disabled}
        onClick={onSave}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          borderRadius: 4,
          border: 'none',
          background: disabled ? '#444' : '#3b82f6',
          color: 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 500,
        }}
      >
        {label}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }): JSX.Element | null {
  if (status.kind === 'ready') return <span style={{ fontSize: 13 }}>Bereit</span>;
  if (status.kind === 'saved') {
    return (
      <span style={{ fontSize: 13, color: '#86efac' }}>
        Gespeichert · {new Date(status.at).toLocaleTimeString()}
      </span>
    );
  }
  if (status.kind === 'error') {
    return (
      <span
        style={{ fontSize: 13, color: '#fca5a5', maxWidth: 360 }}
        title={status.message}
      >
        Fehler: {status.message.slice(0, 80)}
        {status.message.length > 80 ? '…' : ''}
      </span>
    );
  }
  return null;
}
