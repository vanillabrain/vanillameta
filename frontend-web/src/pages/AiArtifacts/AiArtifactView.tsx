import React from 'react';
import { ArtifactMarkdown } from './ArtifactMarkdown';
import { ArtifactSourceDownload } from './ArtifactSourceDownload';
import { RestoreRevision } from './RestoreRevision';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, History } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { z } from 'zod';
import { aiArtifactService, AiArtifactDetail } from '@/api/aiArtifactService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';

const htmlSchema = z.object({ html: z.string() });
const documentSchema = z.object({ markdown: z.string() });
const sheetSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
});
const chartSchema = z.object({
  chartType: z.enum(['bar', 'line']),
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), data: z.array(z.number()) })),
});

function HtmlBody({ content }: { content: Record<string, unknown> }) {
  const { html } = htmlSchema.parse(content);
  return (
    <iframe
      title="artifact"
      sandbox=""
      referrerPolicy="no-referrer"
      {...({
        csp: "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      } as unknown as React.IframeHTMLAttributes<HTMLIFrameElement>)}
      srcDoc={html}
      className="min-h-[480px] w-full rounded-xl border border-border bg-white"
    />
  );
}

function SheetBody({ content }: { content: Record<string, unknown> }) {
  const { columns, rows } = sheetSchema.parse(content);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column} className="border-b border-border px-4 py-2 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td key={column} className="border-b border-border px-4 py-2">
                  {row[columnIndex] === null ? '' : String(row[columnIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBody({ content }: { content: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { chartType, labels, series } = chartSchema.parse(content);
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map(item => item.name) },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: series.map(item => ({
      name: item.name,
      type: chartType,
      data: item.data,
      ...(chartType === 'bar' ? { label: { show: true, position: 'top' } } : {}),
    })),
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <ReactECharts option={option} style={{ height: 420 }} notMerge={true} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm" aria-label={t('aiArtifact.chartValues')}>
          <caption className="pb-2 text-left font-medium">{t('aiArtifact.chartValues')}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-4 py-2 text-left font-semibold">
                {t('aiArtifact.category')}
              </th>
              {series.map((item, seriesIndex) => (
                <th
                  key={item.name + '-' + seriesIndex}
                  scope="col"
                  className="border-b border-border px-4 py-2 text-left font-semibold"
                >
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, rowIndex) => (
              <tr key={`${label}-${rowIndex}`}>
                <th scope="row" className="border-b border-border px-4 py-2 text-left font-normal">
                  {label}
                </th>
                {series.map((item, seriesIndex) => (
                  <td key={item.name + '-' + seriesIndex} className="border-b border-border px-4 py-2">
                    {String(item.data[rowIndex] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Body({ artifact }: { artifact: AiArtifactDetail }) {
  if (artifact.kind === 'html') return <HtmlBody content={artifact.content} />;
  if (artifact.kind === 'document') return <ArtifactMarkdown markdown={documentSchema.parse(artifact.content).markdown} />;
  if (artifact.kind === 'sheet') return <SheetBody content={artifact.content} />;
  return <ChartBody content={artifact.content} />;
}

function ArtifactSharing({ id, scope }: { id: string; scope: string }) {
  const { t } = useTranslation();
  const [login, setLogin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const recipients = useQuery({
    queryKey: ['ai-artifact-recipients', scope, id],
    queryFn: ({ signal }) => aiArtifactService.recipients(id, signal),
    enabled: open,
    retry: false,
  });
  async function update(active: boolean, recipient: string) {
    if (busy || !recipient) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await aiArtifactService.share(id, recipient, active);
      setMessage(t(result.active ? 'aiArtifact.granted' : 'aiArtifact.revoked', { login: recipient }));
      if (active) setLogin('');
      await recipients.refetch();
    } catch {
      setMessage(t('aiArtifact.shareError'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details onToggle={event => setOpen(event.currentTarget.open)} className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-semibold">{t('aiArtifact.shareTitle')}</summary>
      <p className="my-3 text-sm text-muted-foreground">{t('aiArtifact.shareHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('aiArtifact.recipient')}
          <input
            className="h-10 rounded-md border border-input bg-background px-3"
            value={login}
            disabled={busy}
            onChange={event => {
              setLogin(event.target.value);
              setMessage('');
            }}
          />
        </label>
        <Button disabled={busy || !login.trim()} onClick={() => update(true, login.trim())}>
          {t('aiArtifact.grant')}
        </Button>
      </div>
      <p role="status" className="mt-2 text-sm">
        {message}
      </p>
      {open && (
        <section className="mt-4 border-t border-border pt-3" aria-label={t('aiArtifact.recipients')}>
          <h2 className="mb-2 text-sm font-medium">{t('aiArtifact.recipients')}</h2>
          {recipients.isFetching ? (
            <p role="status">{t('aiArtifact.loading')}</p>
          ) : recipients.isError ? (
            <p role="alert">
              {t('aiArtifact.recipientsError')}{' '}
              <Button variant="outline" onClick={() => recipients.refetch()}>
                {t('aiArtifact.retryHistory')}
              </Button>
            </p>
          ) : recipients.data?.length ? (
            <ul>
              {recipients.data.map(person => (
                <li key={person.login} className="flex items-center justify-between gap-3 py-1">
                  <span className="break-all text-sm">{person.login}</span>
                  <Button
                    variant="outline"
                    disabled={busy}
                    aria-label={t('aiArtifact.revokePerson', { login: person.login })}
                    onClick={() => update(false, person.login)}
                  >
                    {t('aiArtifact.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('aiArtifact.noRecipients')}</p>
          )}
        </section>
      )}
    </details>
  );
}

function OwnerView({ latest, scope }: { latest: AiArtifactDetail; scope: string }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const value = params.get('revision');
  const wanted = Number(value);
  const isPast = value !== null && wanted !== latest.revision;
  const valid = /^[1-9]\d*$/.test(value ?? '') && Number.isSafeInteger(wanted) && wanted < latest.revision;
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const toggle = React.useRef<HTMLButtonElement>(null);
  const historyId = React.useId();
  const history = useQuery({
    queryKey: ['ai-artifact-history', scope, latest.id, latest.revision],
    queryFn: ({ signal }) => aiArtifactService.revisions(latest.id, signal),
    enabled: historyOpen && latest.revision > 1,
    retry: false,
  });
  const previous = useQuery({
    queryKey: ['ai-artifact-version', scope, latest.id, value],
    queryFn: ({ signal }) => aiArtifactService.revision(latest.id, wanted, signal),
    enabled: isPast && valid,
    retry: false,
  });
  const select = (revision: string) => {
    const next = new URLSearchParams(params);
    if (revision === String(latest.revision)) next.delete('revision');
    else next.set('revision', revision);
    setParams(next);
    setHistoryOpen(false);
    toggle.current?.focus();
  };
  const shown = isPast ? (valid && !previous.isError && !previous.isFetching ? previous.data : undefined) : latest;
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{shown?.title ?? t('aiArtifact.history')}</h1>
          {shown && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t(isPast ? 'aiArtifact.pastRevision' : 'aiArtifact.latestRevision', { revision: shown.revision })}
            </p>
          )}
        </div>
        {latest.revision > 1 && (
          <Button
            ref={toggle}
            variant="outline"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen(open => !open)}
          >
            <History aria-hidden="true" className="size-4" />
            {t('aiArtifact.history')}
            <ChevronDown aria-hidden="true" className={historyOpen ? 'size-4 rotate-180' : 'size-4'} />
          </Button>
        )}
      </header>
      {historyOpen && (
        <section
          id={historyId}
          aria-label={t('aiArtifact.history')}
          className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-2"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setHistoryOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          {history.isFetching && (
            <p role="status" className="p-2 text-sm">
              {t('aiArtifact.loading')}
            </p>
          )}
          {history.isError && (
            <p role="alert" className="p-2">
              {t('aiArtifact.historyError')}{' '}
              <Button variant="outline" onClick={() => history.refetch()}>
                {t('aiArtifact.retryHistory')}
              </Button>
            </p>
          )}
          {!history.isError && !history.isFetching && (
            <ul>
              {history.data?.map(item => {
                const current = item.revision === (value === null ? latest.revision : wanted);
                return (
                  <li key={item.revision}>
                    <Button
                      variant="ghost"
                      className="h-auto min-h-10 w-full flex-wrap justify-start gap-2 px-3"
                      aria-current={current ? 'true' : undefined}
                      onClick={() => select(String(item.revision))}
                    >
                      <span>
                        {t(item.revision === latest.revision ? 'aiArtifact.latestRevision' : 'aiArtifact.pastRevision', {
                          revision: item.revision,
                        })}
                      </span>
                      {current && <Check aria-hidden="true" className="size-4" />}
                      <time className="ml-auto text-xs text-muted-foreground" dateTime={item.updatedAt}>
                        {new Date(item.updatedAt).toLocaleString()}
                      </time>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {isPast && (
        <Button className="self-start" variant="outline" onClick={() => select(String(latest.revision))}>
          {t('aiArtifact.returnLatest')}
        </Button>
      )}
      {isPast && valid && previous.isFetching && <p role="status">{t('aiArtifact.loading')}</p>}
      {isPast && (!valid || previous.isError) && <p role="alert">{t('aiArtifact.unavailableRevision')}</p>}
      {isPast && shown && (
        <RestoreRevision
          key={latest.id + ':' + wanted + ':' + latest.revision}
          id={latest.id}
          revision={wanted}
          expectedRevision={latest.revision}
          scope={scope}
          openLatest={() => {
            const next = new URLSearchParams(params);
            next.delete('revision');
            setParams(next);
            toggle.current?.focus();
          }}
        />
      )}
      {!isPast && <ArtifactSharing id={latest.id} scope={scope} />}
      {shown && (
        <>
          <Body artifact={shown} />
          <ArtifactSourceDownload key={scope + ':' + shown.id + ':' + shown.revision} id={shown.id} revision={shown.revision} scope={scope} />
        </>
      )}
    </>
  );
}

export default function AiArtifactView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { listHref } = artifactListNavigation(useLocation());
  const scope = personalLibrarySessionScope();
  const query = useQuery({
    queryKey: ['ai-artifact', scope, id],
    queryFn: async ({ signal }) => {
      const detail = await aiArtifactService.detail(id as string, signal);
      if (scope !== personalLibrarySessionScope()) throw new Error('Session changed');
      return detail;
    },
    enabled: !!scope && !!id,
    retry: false,
    refetchOnWindowFocus: true,
  });
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 p-4 sm:p-8 lg:p-12">
      <Button asChild variant="ghost" className="h-10 self-start">
        <Link to={listHref}>{t('aiArtifact.back')}</Link>
      </Button>
      {query.isFetching && <p role="status">{t('aiArtifact.loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {t('aiArtifact.error')}
        </p>
      )}
      {!query.isFetching &&
        !query.isError &&
        query.data &&
        (query.data.role === 'owner' && scope ? (
          <OwnerView key={query.data.id} latest={query.data} scope={scope} />
        ) : (
          <>
            <h1 className="break-words text-2xl font-semibold">{query.data.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t('aiArtifact.revision')} {query.data.revision}
            </p>
            {query.data.role === 'recipient' && <p>{t('aiArtifact.readOnly')}</p>}
            <Body artifact={query.data} />
          </>
        ))}
    </main>
  );
}
