import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [integrations, setIntegrations] = useState<{
    googleDocs: boolean;
    microsoft: boolean;
    sheets: boolean;
  } | null>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const reload = () => {
    restoreFocus.current = true;
    setRead(value => value + 1);
  };
  useLayoutEffect(() => {
    if (state.kind === 'loading' || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement !== document.body && document.activeElement !== document.documentElement) return;
    if (state.kind === 'error') retryButton.current?.focus();
    else headingRef.current?.focus();
  }, [state.kind]);
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
  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    documentService
      .integrations()
      .then(value => {
        if (!controller.signal.aborted)
          setIntegrations(value as { googleDocs: boolean; microsoft: boolean; sheets: boolean });
      })
      .catch(() => {
        if (!controller.signal.aborted) setIntegrations(null);
      });
    return () => controller.abort();
  }, [scope]);
  return (
    <DocumentFrame title={t('docConnection.title')} headingRef={headingRef}>
      {integrations && (!integrations.microsoft || !integrations.sheets) && (
        <p role="status" className="text-sm text-muted-foreground">
          외부 연동 · Google 문서 {integrations.googleDocs ? '사용 가능' : '설정 필요'} · Microsoft
          {integrations.microsoft ? '사용 가능' : '설정 필요'} · Sheets
          {integrations.sheets ? '사용 가능' : '설정 필요'}
        </p>
      )}
      {state.kind === 'loading' && <p role="status">{t('docConnection.loading')}</p>}
      <p className="text-sm">
        <Link className="underline" to="/documents/sheets">
          Sheets 가져오기
        </Link>
        {' · '}
        <Link className="underline" to="/documents/microsoft">
          Microsoft 문서 연결
        </Link>
      </p>
      {state.kind === 'error' && (
        <>
          <p role="alert">{t('docConnection.loadError')}</p>
          <Button ref={retryButton} className="h-10 self-start" onClick={reload}>
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
