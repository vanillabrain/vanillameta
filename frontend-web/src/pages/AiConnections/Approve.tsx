import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { aiConnectionsService, AiScope, ConsentDecision, ConsentRequest } from '@/api/aiConnectionsService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { ConnectionFrame, useConnectionScope } from './shared';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'terminal' }
  | { kind: 'review'; request: ConsentRequest; scopes: AiScope[] }
  | { kind: 'submitting' };
function Consent({ ticket, scope }: { ticket: string; scope: string | null }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const locked = useRef(false);
  const mounted = useRef(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (!scope) setState({ kind: 'error' });
    else
      aiConnectionsService
        .request(ticket, controller.signal)
        .then(request => {
          if (!controller.signal.aborted && scope === personalLibrarySessionScope())
            setState({ kind: 'review', request, scopes: request.requestedScopes });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ kind: 'error' });
        });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [ticket, scope]);
  const decide = async (input: ConsentDecision) => {
    if (
      locked.current ||
      state.kind !== 'review' ||
      scope === null ||
      scope !== personalLibrarySessionScope() ||
      Date.parse(state.request.expiresAt) <= Date.now()
    )
      return;
    locked.current = true;
    const request = state.request;
    setState({ kind: 'submitting' });
    try {
      const redirect = await aiConnectionsService.decide(request, input);
      if (mounted.current && scope === personalLibrarySessionScope()) window.location.assign(redirect);
    } catch {
      if (mounted.current && scope === personalLibrarySessionScope()) setState({ kind: 'terminal' });
    }
  };
  const current = scope !== null && scope === personalLibrarySessionScope();
  if (!current || state.kind === 'error' || state.kind === 'terminal')
    return (
      <>
        <p role="alert">{t(state.kind === 'terminal' ? 'aiConnections.decisionError' : 'aiConnections.requestError')}</p>
        <Button asChild variant="outline" className="h-10 self-start">
          <Link to="/ai-connections">{t('aiConnections.return')}</Link>
        </Button>
      </>
    );
  if (state.kind === 'loading' || state.kind === 'submitting')
    return <p role="status">{t(state.kind === 'loading' ? 'aiConnections.loading' : 'aiConnections.working')}</p>;
  const expired = Date.parse(state.request.expiresAt) <= now;
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck />
        {t('aiConnections.consentTitle', { client: state.request.clientName })}
      </h2>
      <dl className="grid grid-cols-[160px_1fr] gap-3 text-sm">
        <dt>{t('aiConnections.client')}</dt>
        <dd>
          {state.request.clientName} <span className="text-muted-foreground">({state.request.clientId})</span>
        </dd>
        <dt>{t('aiConnections.account')}</dt>
        <dd>{state.request.accountLabel}</dd>
        <dt>
          <label htmlFor="consent-org">{t('aiConnections.organization')}</label>
        </dt>
        <dd>
          <select
            id="consent-org"
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={state.request.organization.id}
            disabled
          >
            <option value={state.request.organization.id}>{state.request.organization.name}</option>
          </select>
        </dd>
        <dt>{t('aiConnections.callback')}</dt>
        <dd className="break-all">{state.request.redirectUri}</dd>
        <dt>{t('aiConnections.expires')}</dt>
        <dd>{new Date(state.request.expiresAt).toLocaleString()}</dd>
      </dl>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t('aiConnections.scopes')}</legend>
        {state.request.requestedScopes.map(scopeName => (
          <label
            key={scopeName}
            className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={state.scopes.includes(scopeName)}
              disabled={expired}
              onChange={event => {
                const checked = event.target.checked;
                setState(previous =>
                  previous.kind === 'review'
                    ? {
                        ...previous,
                        scopes: checked
                          ? [...previous.scopes, scopeName]
                          : previous.scopes.filter(value => value !== scopeName),
                      }
                    : previous,
                );
              }}
            />
            {t(`aiConnections.${scopeName === 'sources:read' ? 'sourcesRead' : 'documentsRead'}`)}
          </label>
        ))}
      </fieldset>
      {expired && <p role="alert">{t('aiConnections.expired')}</p>}
      <div className="flex gap-3">
        <Button
          className="h-10"
          disabled={expired || state.scopes.length === 0}
          onClick={() => void decide({ decision: 'approve', scopes: state.scopes })}
        >
          {t('aiConnections.approve')}
        </Button>
        <Button
          variant="outline"
          className="h-10"
          disabled={expired}
          onClick={() => void decide({ decision: 'cancel', scopes: [] })}
        >
          {t('aiConnections.cancel')}
        </Button>
      </div>
    </section>
  );
}
export default function Approve() {
  const { ticket = '' } = useParams();
  const scope = useConnectionScope();
  return (
    <ConnectionFrame>
      <Consent key={JSON.stringify([ticket, scope])} ticket={ticket} scope={scope} />
    </ConnectionFrame>
  );
}
