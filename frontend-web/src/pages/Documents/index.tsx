import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { documentService, DocumentList } from '@/api/documentService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import ConnectDialog from './ConnectDialog';
import { DocumentFrame, useDocumentScope } from './shared';

type ListState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: DocumentList };
function DocumentsList({ scope }: { scope: string | null }) {
  const { t } = useTranslation();
  const { link } = artifactListNavigation(useLocation());
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [read, setRead] = useState(0);
  useEffect(() => {
    if (!scope) {
      setState({ kind: 'error' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    documentService
      .list(controller.signal)
      .then(data => {
        if (!controller.signal.aborted && scope === personalLibrarySessionScope()) setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, [scope, read]);
  return (
    <DocumentFrame title={t('docConnection.title')}>
      {state.kind === 'loading' && <p role="status">{t('docConnection.loading')}</p>}
      {state.kind === 'error' && (
        <>
          <p role="alert">{t('docConnection.loadError')}</p>
          <Button className="h-10 self-start" onClick={() => setRead(value => value + 1)}>
            {t('docConnection.reload')}
          </Button>
        </>
      )}
      {state.kind === 'ready' && (
        <>
          {!state.data.configured && <p role="status">{t('docConnection.notConfigured')}</p>}
          {state.data.organizationId === null && <p>{t('docConnection.membershipRequired')}</p>}
          <div>
            <ConnectDialog
              scope={scope}
              disabled={!state.data.configured || state.data.organizationId === null || state.data.documents.length >= 20}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t('docConnection.limits')}</p>
          {state.data.documents.length === 0 ? (
            <p>{t('docConnection.empty')}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {state.data.documents.map(document => (
                <li key={document.id} className="flex items-center justify-between gap-6 p-5">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-medium">
                      <FileText />
                      <Link className="underline" to={link(`/documents/${document.id}`)}>
                        {document.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(document.connected ? 'docConnection.connected' : 'docConnection.disconnected')} ·{' '}
                      {document.currentVersion
                        ? t('docConnection.version', { version: document.currentVersion })
                        : t('docConnection.awaitingCopy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('docConnection.updatedAt')} {new Date(document.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="h-10">
                    <Link to={link(`/documents/${document.id}`)}>{t('docConnection.open')}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </DocumentFrame>
  );
}
export default function Documents() {
  const scope = useDocumentScope();
  return <DocumentsList key={scope ?? 'none'} scope={scope} />;
}
