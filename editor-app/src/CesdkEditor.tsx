import { useEffect, useRef, useState } from 'react';
import CreativeEditorSDK from '@cesdk/cesdk-js';

interface Props {
  templateId: string;
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
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

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

        const res = await fetch(
          `/api/template/${encodeURIComponent(templateId)}`,
        );
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
    setStatus({ kind: 'saving' });
    try {
      const archive = await instance.engine.scene.saveToArchive();
      const buffer = await archive.arrayBuffer();
      const res = await fetch(
        `/api/template/${encodeURIComponent(templateId)}`,
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
      <SaveBar status={status} onSave={() => void onSave()} />
    </div>
  );
}

function SaveBar({
  status,
  onSave,
}: {
  status: Status;
  onSave: () => void;
}): JSX.Element {
  const disabled = status.kind === 'loading' || status.kind === 'saving';
  const label =
    status.kind === 'saving'
      ? 'Speichere ...'
      : status.kind === 'loading'
        ? 'Lade ...'
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
