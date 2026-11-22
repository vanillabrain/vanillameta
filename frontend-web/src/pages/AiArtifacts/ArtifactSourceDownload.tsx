import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { aiArtifactService } from '@/api/aiArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';

type Props = { id: string; revision: number; scope: string };

export function ArtifactSourceDownload({ id, revision, scope }: Props) {
  const { t } = useTranslation();
  const inFlight = React.useRef<AbortController | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'started' | 'error'>('idle');
  React.useEffect(() => () => inFlight.current?.abort(), []);

  async function download() {
    if (inFlight.current || personalLibrarySessionScope() !== scope) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus('loading');
    try {
      // Recheck ownership and fetch the selected version even if another client changed the head.
      const { title, kind, content } = await aiArtifactService.revision(id, revision, controller.signal);
      if (controller.signal.aborted || personalLibrarySessionScope() !== scope) return;
      const blob = new Blob([JSON.stringify({ kind, title, content }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        const name = Array.from(title.replace(/[\\/:*?\x22<>|.\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '').trim()).slice(0, 48).join('');
        link.href = url;
        link.download = (name || 'artifact') + '-v' + revision + '.json';
        document.body.appendChild(link);
        link.click();
        setStatus('started');
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      inFlight.current = null;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={download} disabled={status === 'loading'}>
        <Download aria-hidden="true" className="size-4" />
        {t('aiArtifact.downloadSource')}
      </Button>
      {status === 'started' && <span role="status" className="text-sm">{t('aiArtifact.downloadStarted', { revision })}</span>}
      {status === 'error' && <span role="alert" className="text-sm">{t('aiArtifact.downloadError')}</span>}
    </div>
  );
}
