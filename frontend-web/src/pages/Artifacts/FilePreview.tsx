import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileArtifactSummary } from '@/api/fileArtifactService';
import { Button } from '@/components/ui/button';

type ContentState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; url: string };
export default function FilePreview({
  artifact,
  load,
  originalName,
}: {
  artifact: FileArtifactSummary;
  load: (signal: AbortSignal) => Promise<Blob>;
  originalName?: string;
}) {
  const { t } = useTranslation();
  const [read, setRead] = useState(0);
  const [state, setState] = useState<ContentState>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setState({ kind: 'loading' });
    load(controller.signal)
      .then(blob => {
        if (controller.signal.aborted) return;
        const mime = {
          html: 'text/html',
          pdf: 'application/pdf',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }[artifact.kind];
        url = URL.createObjectURL(new Blob([blob], { type: mime }));
        setState({ kind: 'ready', url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [load, artifact.kind, read]);
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={t('fileArtifact.preview')}>
      {state.kind === 'loading' && <p role="status">{t('fileArtifact.loading')}</p>}
      {state.kind === 'error' && (
        <>
          <p role="alert">{t('fileArtifact.contentError')}</p>
          <Button variant="outline" onClick={() => setRead(value => value + 1)}>
            {t('fileArtifact.reload')}
          </Button>
        </>
      )}
      {(!artifact.safePreview || artifact.kind === 'pptx') && (
        <p className="text-sm text-muted-foreground">{t('fileArtifact.metadataOnly')}</p>
      )}
      {state.kind === 'ready' && (
        <>
          <Button asChild variant="outline" className="h-10 self-start">
            <a href={state.url} download={originalName ?? `${artifact.title}.${artifact.kind}`}>
              {t('fileArtifact.download')}
            </a>
          </Button>
          {artifact.safePreview && artifact.kind === 'html' && (
            <iframe
              title={t('fileArtifact.preview')}
              src={state.url}
              sandbox=""
              referrerPolicy="no-referrer"
              className="h-[65vh] min-h-[320px] w-full min-w-0 rounded-xl border bg-white"
            />
          )}
          {artifact.safePreview && artifact.kind === 'pdf' && (
            <object
              title={t('fileArtifact.preview')}
              data={state.url}
              type="application/pdf"
              className="h-[65vh] min-h-[320px] w-full min-w-0 rounded-xl border bg-white"
            >
              <a href={state.url} download={originalName ?? artifact.title + '.pdf'}>
                {t('fileArtifact.download')}
              </a>
            </object>
          )}
        </>
      )}
    </section>
  );
}
