import { useEffect, useState } from 'react';

import { CesdkEditor } from './CesdkEditor';

function getTemplateIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('template');
  return id && id.trim() !== '' ? id : null;
}

export function App(): JSX.Element {
  const [templateId, setTemplateId] = useState<string | null>(
    getTemplateIdFromQuery(),
  );
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const onPop = (): void => setTemplateId(getTemplateIdFromQuery());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (!templateId) {
    return (
      <div
        style={{
          padding: 40,
          maxWidth: 600,
          margin: '0 auto',
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ marginTop: 0 }}>CE.SDK Template-Editor</h1>
        <p>
          Es wurde keine <code>?template=&lt;id&gt;</code>-Query mitgegeben. Der
          Editor wird in der Regel direkt vom MCP-Tool <code>setup_template</code>{' '}
          mit der korrekten URL geöffnet.
        </p>
        <p>Falls du eine ID hast, kannst du sie hier eingeben:</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputValue.trim() !== '') {
              const next = inputValue.trim();
              window.history.pushState(
                {},
                '',
                `?template=${encodeURIComponent(next)}`,
              );
              setTemplateId(next);
            }
          }}
        >
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Template-ID"
            style={{
              padding: '8px 12px',
              fontSize: 16,
              width: 320,
              borderRadius: 4,
              border: '1px solid #444',
              background: '#222',
              color: '#e8e8e8',
            }}
          />
          <button
            type="submit"
            style={{
              marginLeft: 8,
              padding: '8px 16px',
              fontSize: 16,
              borderRadius: 4,
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Öffnen
          </button>
        </form>
      </div>
    );
  }

  return <CesdkEditor templateId={templateId} />;
}
