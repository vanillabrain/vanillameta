import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Unplug } from 'lucide-react';
import { aiConnectionsService, AiConnection, AiConnectionList } from '@/api/aiConnectionsService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConnectionFrame, useConnectionScope } from './shared';

function Disconnect({ connection, scope, onRevoked }: { connection: AiConnection; scope: string; onRevoked: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const disconnect = async () => {
    if (lock.current || scope !== personalLibrarySessionScope()) return;
    lock.current = true;
    setStatus('busy');
    try {
      await aiConnectionsService.disconnect(connection.id);
      if (mounted.current && scope === personalLibrarySessionScope()) {
        setOpen(false);
        onRevoked();
      }
    } catch {
      if (mounted.current && scope === personalLibrarySessionScope()) setStatus('error');
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (status !== 'busy') setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10" disabled={connection.revoked}>
          <Unplug />
          {t('aiConnections.disconnect')}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={status !== 'busy'}
        onCloseAutoFocus={event => {
          if (connection.revoked) {
            event.preventDefault();
            document.getElementById('ai-connections-reload')?.focus();
          }
        }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          document.getElementById(`keep-${connection.id}`)?.focus();
        }}
        onEscapeKeyDown={event => {
          if (status === 'busy') event.preventDefault();
        }}
        onPointerDownOutside={event => {
          if (status === 'busy') event.preventDefault();
        }}
      >
        <DialogTitle>{t('aiConnections.disconnectTitle', { client: connection.clientName })}</DialogTitle>
        <DialogDescription>{t('aiConnections.disconnectHint')}</DialogDescription>
        {status === 'error' && <p role="alert">{t('aiConnections.disconnectError')}</p>}
        <DialogFooter>
          <Button
            id={`keep-${connection.id}`}
            variant="outline"
            className="h-10"
            disabled={status === 'busy'}
            onClick={() => setOpen(false)}
          >
            {t('aiConnections.keep')}
          </Button>
          <Button className="h-10" disabled={status !== 'idle'} onClick={() => void disconnect()}>
            {t(status === 'busy' ? 'aiConnections.working' : 'aiConnections.confirmDisconnect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: AiConnectionList };
function Connections({ scope }: { scope: string | null }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [read, setRead] = useState(0);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const restoreReloadFocus = useRef(false);
  const reload = () => {
    restoreReloadFocus.current = true;
    setRead(value => value + 1);
  };
  useLayoutEffect(() => {
    if (state.kind !== 'loading' && restoreReloadFocus.current) {
      restoreReloadFocus.current = false;
      if (document.activeElement === document.body || document.activeElement === document.documentElement)
        reloadButton.current?.focus();
    }
  }, [state.kind]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    if (!scope) setState({ kind: 'error' });
    else
      aiConnectionsService
        .list(controller.signal)
        .then(data => {
          if (!controller.signal.aborted && scope === personalLibrarySessionScope()) setState({ kind: 'ready', data });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ kind: 'error' });
        });
    return () => controller.abort();
  }, [scope, read]);
  if (scope === null || scope !== personalLibrarySessionScope() || state.kind === 'error')
    return (
      <>
        <p role="alert">{t('aiConnections.loadError')}</p>
        <Button ref={reloadButton} className="h-10 self-start" variant="outline" onClick={reload}>
          {t('aiConnections.reload')}
        </Button>
      </>
    );
  if (state.kind === 'loading') return <p role="status">{t('aiConnections.loading')}</p>;
  return (
    <>
      {!state.data.configured && <p role="status">{t('aiConnections.notConfigured')}</p>}
      <p>
        {t('aiConnections.organization')}: {state.data.organization?.name ?? t('aiConnections.membershipRequired')}
      </p>
      {state.data.resourceUrl && (
        <p className="break-all text-sm text-muted-foreground">
          {t('aiConnections.resource')}: {state.data.resourceUrl}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t('aiConnections.startHint')}</p>
      <p className="text-sm text-muted-foreground">{t('aiConnections.tokenLifetime')}</p>
      {state.data.connections.length === 0 ? (
        <p>{t('aiConnections.empty')}</p>
      ) : (
        <ul className="divide-y rounded-xl border border-border">
          {state.data.connections.map(connection => (
            <li key={connection.id} className="flex items-start justify-between gap-6 p-6">
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="font-semibold">{connection.clientName}</h2>
                <p className="text-sm text-muted-foreground">{connection.clientId}</p>
                <ul className="text-sm">
                  {connection.scopes.map(scopeName => (
                    <li key={scopeName}>
                      {t(`aiConnections.${scopeName === 'sources:read' ? 'sourcesRead' : 'documentsRead'}`)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  {t('aiConnections.created')}: {new Date(connection.createdAt).toLocaleString()}
                </p>
                <p className="text-sm">
                  {t('aiConnections.grantExpires')}: {new Date(connection.expiresAt).toLocaleString()}
                </p>
                {connection.revoked && (
                  <p role="status" className="text-sm">
                    {t('aiConnections.revoked')}
                  </p>
                )}
              </div>
              <Disconnect
                key={`${connection.id}-${read}`}
                connection={connection}
                scope={scope}
                onRevoked={() =>
                  setState(previous =>
                    previous.kind === 'ready'
                      ? {
                          kind: 'ready',
                          data: {
                            ...previous.data,
                            connections: previous.data.connections.map(item =>
                              item.id === connection.id ? { ...item, revoked: true } : item,
                            ),
                          },
                        }
                      : previous,
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Button ref={reloadButton} id="ai-connections-reload" variant="outline" className="h-10 self-start" onClick={reload}>
        {t('aiConnections.reload')}
      </Button>
      <Link to="/dashboard" className="text-sm underline">
        {t('nav.artifacts')}
      </Link>
    </>
  );
}
export default function AiConnections() {
  const scope = useConnectionScope();
  return (
    <ConnectionFrame>
      <Connections key={scope ?? 'signed-out'} scope={scope} />
    </ConnectionFrame>
  );
}
