import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import {
  documentService,
  DocumentDetail as Detail,
  DocumentList,
  DocumentSnapshot,
  RefreshResult,
} from '@/api/documentService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ConnectDialog from './ConnectDialog';
import { DocumentFrame, useDocumentScope } from './shared';
import { clearPending, PendingRefresh, readPending, recoveryKey, storePending } from './refreshRecovery';

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; detail: Detail; list: DocumentList };
type RefreshState =
  | { kind: 'idle' }
  | { kind: 'busy'; pending: PendingRefresh }
  | { kind: 'uncertain' | 'missing' | 'running' | 'failed'; pending: PendingRefresh }
  | { kind: 'completed'; result: RefreshResult };
function DetailPage({ id, scope }: { id: string; scope: string | null }) {
  const { t } = useTranslation();
  const key = recoveryKey(scope, id);
  const [read, setRead] = useState<ReadState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const [refresh, setRefresh] = useState<RefreshState>(() => {
    const pending = readPending(key);
    return pending ? { kind: 'uncertain', pending } : { kind: 'idle' };
  });
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [needsRead, setNeedsRead] = useState(false);
  const [consent, setConsent] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [aiSummary, setAiSummary] = useState<{ summary: string; version: number; generatedAt: string } | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const versionRead = useRef(0);
  const current = () => alive.current && scope !== null && personalLibrarySessionScope() === scope;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      versionRead.current += 1;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    versionRead.current += 1;
    setVersionBusy(false);
    setRead({ kind: 'loading' });
    setSnapshot(null);
    if (!scope) {
      setRead({ kind: 'error' });
      return;
    }
    Promise.all([documentService.detail(id, controller.signal), documentService.list(controller.signal)])
      .then(([detail, list]) => {
        if (!controller.signal.aborted && current()) {
          setRead({ kind: 'ready', detail, list });
          setSnapshot(detail.snapshot);
          setNeedsRead(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && current()) setRead({ kind: 'error' });
      });
    return () => controller.abort();
  }, [id, scope, reload]);
  const canWrite = read.kind === 'ready' && read.list.organizationId !== null && scope !== null && !needsRead;
  const connected = read.kind === 'ready' && read.detail.connected;
  const pending = 'pending' in refresh ? refresh.pending : null;
  const isBusy = refresh.kind === 'busy' || disconnectBusy;
  const newAttempt =
    refresh.kind === 'failed' ||
    (refresh.kind === 'missing' && read.kind === 'ready' && read.detail.currentVersion > refresh.pending.expectedVersion);
  const missingDisconnectedRequest = refresh.kind === 'missing' && read.kind === 'ready' && !read.detail.connected;
  const blocksCredentialRepair = !!pending && !newAttempt && !missingDisconnectedRequest;
  const runRefresh = async (input: PendingRefresh) => {
    if (lock.current || !current() || !canWrite || !connected) return;
    lock.current = true;
    storePending(key, input);
    setRefresh({ kind: 'busy', pending: input });
    setError('');
    try {
      const result = await documentService.refresh(id, input);
      if (current()) {
        clearPending(key);
        setRefresh({ kind: 'completed', result });
        setReload(value => value + 1);
      }
    } catch {
      if (current()) {
        setRefresh({ kind: 'uncertain', pending: input });
        setError('refreshError');
      }
    } finally {
      lock.current = false;
    }
  };
  const lookup = async () => {
    if (!pending || lock.current || !current()) return;
    lock.current = true;
    const input = pending;
    setRefresh({ kind: 'busy', pending: input });
    setError('');
    try {
      const result = await documentService.request(id, input.requestId);
      if (current()) {
        if (result.status === 'completed') {
          clearPending(key);
          setRefresh({ kind: 'completed', result: result.result });
          setReload(value => value + 1);
        } else {
          setRefresh({ kind: result.status, pending: input });
          if (result.status === 'failed' || result.status === 'missing') {
            setNeedsRead(true);
            setReload(value => value + 1);
          }
        }
      }
    } catch {
      if (current()) {
        setRefresh({ kind: 'uncertain', pending: input });
        setError('lookupError');
      }
    } finally {
      lock.current = false;
    }
  };
  const chooseVersion = async (value: number) => {
    versionRead.current += 1;
    const turn = versionRead.current;
    setVersionBusy(true);
    setError('');
    setSnapshot(null);
    try {
      const next = await documentService.snapshot(id, value);
      if (turn === versionRead.current && current()) setSnapshot(next);
    } catch {
      if (turn === versionRead.current && current()) setError('versionError');
    } finally {
      if (turn === versionRead.current && current()) setVersionBusy(false);
    }
  };
  const disconnect = async () => {
    if (lock.current || !canWrite || !current()) return;
    lock.current = true;
    setDisconnectBusy(true);
    setError('');
    try {
      await documentService.disconnect(id);
      if (current()) {
        setDisconnectOpen(false);
        setReload(value => value + 1);
      }
    } catch {
      if (current()) {
        setError('disconnectError');
        setNeedsRead(true);
        setDisconnectOpen(false);
      }
    } finally {
      lock.current = false;
      if (current()) setDisconnectBusy(false);
    }
  };
  return (
    <DocumentFrame title={read.kind === 'ready' ? read.detail.title : t('docConnection.title')}>
      {read.kind === 'loading' && <p role="status">{t('docConnection.loading')}</p>}
      {read.kind === 'error' && <p role="alert">{t('docConnection.loadError')}</p>}
      <div>
        <Button
          className="h-10"
          variant="outline"
          disabled={isBusy || read.kind === 'loading'}
          onClick={() => setReload(value => value + 1)}
        >
          {t('docConnection.reload')}
        </Button>
      </div>
      {error && <p role="alert">{t(`docConnection.${error}`)}</p>}
      {read.kind === 'ready' && (
        <section className="my-6 rounded-xl border p-5" aria-label="AI 요약">
          <h2 className="font-semibold">AI 요약</h2>
          <p className="text-sm text-muted-foreground">
            저장된 버전 본문을 AI로 요약합니다. 호출 비용이 발생하며 결과는 이 버전에만 저장됩니다.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            비용 발생에 동의합니다
          </label>
          <Button
            className="mt-3 h-10"
            variant="outline"
            disabled={!consent || summaryBusy || isBusy}
            onClick={async () => {
              if (!consent || summaryBusy) return;
              setSummaryBusy(true);
              setSummaryError('');
              try {
                setAiSummary(
                  (await documentService.aiSummary(id, { confirmAiCost: true })) as {
                    summary: string;
                    version: number;
                    generatedAt: string;
                  },
                );
              } catch {
                setSummaryError('요약을 만들지 못했습니다. 권한과 AI 설정을 확인한 뒤 다시 시도해 주세요.');
              } finally {
                setSummaryBusy(false);
              }
            }}
          >
            {summaryBusy ? '요약 중…' : '요약 만들기'}
          </Button>
          {summaryError && (
            <p role="alert" className="mt-3 text-sm">
              {summaryError}
            </p>
          )}
          {aiSummary && (
            <article className="mt-4 whitespace-pre-wrap rounded-lg border p-4 text-sm" aria-label="AI 요약 결과">
              {aiSummary.summary}
              <p className="mt-3 text-xs text-muted-foreground">
                버전 {aiSummary.version} · {new Date(aiSummary.generatedAt).toLocaleString()}
              </p>
            </article>
          )}
        </section>
      )}
      {read.kind === 'ready' && (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="flex flex-col gap-3 rounded-xl border p-5" aria-label={t('docConnection.original')}>
            <h2 className="font-semibold">{t('docConnection.original')}</h2>
            <a
              className="flex items-center gap-2 underline"
              href={read.detail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('docConnection.openOriginal')}
              <ExternalLink size={16} />
            </a>
            <p>{t(connected ? 'docConnection.connected' : 'docConnection.disconnected')}</p>
            <div className="flex flex-col gap-3">
              {!connected && (
                <ConnectDialog
                  scope={scope}
                  document={read.detail}
                  disabled={!canWrite || !read.list.configured || isBusy || blocksCredentialRepair}
                />
              )}
              <Button
                className="h-10"
                disabled={
                  !canWrite ||
                  !read.list.configured ||
                  !connected ||
                  isBusy ||
                  !!pending ||
                  read.detail.versions.length >= 50
                }
                onClick={() =>
                  void runRefresh({ requestId: crypto.randomUUID(), expectedVersion: read.detail.currentVersion })
                }
              >
                <RefreshCw />
                {t(read.detail.currentVersion === 0 ? 'docConnection.import' : 'docConnection.refresh')}
              </Button>
              {connected && (
                <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-10" variant="outline" disabled={!canWrite || isBusy || blocksCredentialRepair}>
                      <Unplug />
                      {t('docConnection.disconnect')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>{t('docConnection.disconnect')}</DialogTitle>
                    <DialogDescription>{t('docConnection.disconnectHint')}</DialogDescription>
                    <Button
                      className="h-10"
                      variant="outline"
                      disabled={disconnectBusy}
                      onClick={() => setDisconnectOpen(false)}
                    >
                      {t('docConnection.cancel')}
                    </Button>
                    <Button className="h-10" disabled={disconnectBusy} onClick={() => void disconnect()}>
                      {t('docConnection.confirmDisconnect')}
                    </Button>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {read.list.organizationId === null && <p>{t('docConnection.membershipRequired')}</p>}
          </section>
          <section className="flex flex-col gap-4 rounded-xl border p-5" aria-label={t('docConnection.stored')}>
            <h2 className="font-semibold">{t('docConnection.stored')}</h2>
            <p className="text-sm text-muted-foreground">{t('docConnection.storedHint')}</p>
            {read.detail.versions.length === 0 && <p>{t('docConnection.noSnapshot')}</p>}
            {read.detail.versions.length > 0 && (
              <>
                <label htmlFor="document-version">{t('docConnection.versions')}</label>
                <select
                  id="document-version"
                  className="h-10 rounded-lg border bg-background px-3"
                  value={snapshot?.version ?? ''}
                  disabled={versionBusy}
                  onChange={event => void chooseVersion(Number(event.target.value))}
                >
                  <option value="" disabled>
                    {t('docConnection.selectVersion')}
                  </option>
                  {read.detail.versions.map(item => (
                    <option key={item.version} value={item.version}>
                      {t('docConnection.version', { version: item.version })} · {new Date(item.capturedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </>
            )}
            {versionBusy && <p role="status">{t('docConnection.loading')}</p>}
            {snapshot && (
              <>
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    {t('docConnection.versionDetails')}
                  </summary>
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
                    <dt>{t('docConnection.sourceVersion')}</dt>
                    <dd>{snapshot.sourceVersion}</dd>
                    <dt>{t('docConnection.sourceModifiedAt')}</dt>
                    <dd>{new Date(snapshot.sourceModifiedAt).toLocaleString()}</dd>
                    <dt>{t('docConnection.capturedAt')}</dt>
                    <dd>{new Date(snapshot.capturedAt).toLocaleString()}</dd>
                    <dt>SHA-256</dt>
                    <dd className="break-all font-mono">{snapshot.sha256}</dd>
                    <dt>{t('docConnection.byteSize')}</dt>
                    <dd>{snapshot.byteSize.toLocaleString()}</dd>
                  </dl>
                </details>
                <pre
                  aria-label={t('docConnection.markdown')}
                  className="max-h-[640px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-5 font-mono text-sm"
                >
                  {snapshot.markdown}
                </pre>
              </>
            )}
          </section>
        </div>
      )}
      {pending && (
        <section className="flex flex-col gap-3 rounded-xl border p-5" aria-label={t('docConnection.recovery')}>
          <p role="status">{t(`docConnection.request_${refresh.kind}`)}</p>
          <p className="break-all font-mono text-xs">{pending.requestId}</p>
          <p className="text-sm text-muted-foreground">{t('docConnection.recoveryHint')}</p>
          <div className="flex gap-3">
            <Button className="h-10" variant="outline" disabled={isBusy} onClick={() => void lookup()}>
              {t('docConnection.lookup')}
            </Button>
            {(refresh.kind === 'failed' || refresh.kind === 'missing' || refresh.kind === 'running') && (
              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="h-10"
                    disabled={!canWrite || !connected || read.kind !== 'ready' || !read.list.configured || isBusy}
                  >
                    {t(newAttempt ? 'docConnection.newAttempt' : 'docConnection.retrySame')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>{t('docConnection.confirmAttempt')}</DialogTitle>
                  <DialogDescription>
                    {t(newAttempt ? 'docConnection.newAttemptHint' : 'docConnection.sameAttemptHint')}
                  </DialogDescription>
                  <Button className="h-10" variant="outline" onClick={() => setConfirmOpen(false)}>
                    {t('docConnection.cancel')}
                  </Button>
                  <Button
                    className="h-10"
                    onClick={() => {
                      if (!canWrite || !connected || read.kind !== 'ready' || !read.list.configured || isBusy) return;
                      setConfirmOpen(false);
                      void runRefresh(
                        newAttempt
                          ? { requestId: crypto.randomUUID(), expectedVersion: read.detail.currentVersion }
                          : pending,
                      );
                    }}
                  >
                    {t('docConnection.confirmAttempt')}
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>
      )}
      {refresh.kind === 'completed' && (
        <p role="status">
          {t(refresh.result.unchanged ? 'docConnection.unchanged' : 'docConnection.saved', {
            version: refresh.result.version,
          })}
        </p>
      )}
    </DocumentFrame>
  );
}
export default function DocumentDetail() {
  const { id = '' } = useParams();
  const scope = useDocumentScope();
  return <DetailPage key={`${scope}:${id}`} id={id} scope={scope} />;
}
