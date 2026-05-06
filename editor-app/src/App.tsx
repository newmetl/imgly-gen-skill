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

  useEffect(() => {
    const onPop = (): void => setTemplateId(getTemplateIdFromQuery());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return <CesdkEditor templateId={templateId} />;
}
