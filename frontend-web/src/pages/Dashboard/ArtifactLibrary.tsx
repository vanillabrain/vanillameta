import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import BoardItem from '@/components/BoardItem';
import { ReportLibraryItem } from '../Reports/reportSharingApi';
import { TextField } from '@/components/ui/text-field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { FileText } from 'lucide-react';
import { LibraryView } from '@/api/personalLibraryService';

export type Artifact = {
  id: number | string;
  title?: string;
  updatedAt?: string;
  analysisDefinition?: string;
  library?: { archived: boolean; version: number };
};
const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase();
const time = (value?: string) => {
  const result = value ? Date.parse(value) : NaN;
  return Number.isFinite(result) ? result : 0;
};

/** UC049: discover only within the existing server-authorized list. */
export default function ArtifactLibrary({
  items,
  reports = [],
  reportBoundary,
  reportsReady = true,
  onDelete,
  view = 'active',
  onViewChange,
  onReload,
  loading = false,
  listError = false,
  canArchive = false,
  onArchive,
  archiveDisabled = false,
  archiveError = '',
  busy = false,
}: {
  items: Artifact[];
  reports?: ReportLibraryItem[];
  reportBoundary?: React.RefObject<HTMLDivElement>;
  reportsReady?: boolean;
  onDelete: (id: any, title: any) => void;
  view?: LibraryView;
  onViewChange?: (view: LibraryView) => void;
  onReload?: () => void;
  loading?: boolean;
  listError?: boolean;
  canArchive?: boolean;
  onArchive?: (item: any) => void;
  archiveDisabled?: boolean;
  archiveError?: string;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const navigation = artifactListNavigation(useLocation());
  const reportHref = navigation.link('/reports');
  const [params, setParams] = useSearchParams();
  const query = (params.get('artifactQuery') ?? '').slice(0, 200);
  const kindParam = params.get('artifactKind');
  const kind = kindParam === 'analysis' || kindParam === 'dashboard' || kindParam === 'report' ? kindParam : 'all';
  const sort = params.get('artifactSort') === 'title' ? 'title' : 'recent';
  const display = params.get('artifactDisplay') === 'grid' ? 'grid' : 'list';
  const update = (changes: Record<string, string>) => {
    setParams(
      current => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  type Row = { kind: 'dashboard'; item: Artifact } | { kind: 'report'; item: ReportLibraryItem };
  const rows: Row[] = [
    ...(!loading && !listError ? items.map(item => ({ kind: 'dashboard' as const, item })) : []),
    ...(view === 'active' ? reports.map(item => ({ kind: 'report' as const, item })) : []),
  ];
  const results = useMemo(() => {
    const text = normalized(query);
    return rows
      .filter(row => normalized(row.item.title ?? '').includes(text))
      .filter(
        row =>
          kind === 'all' ||
          (row.kind === 'report'
            ? kind === 'report'
            : kind === 'analysis'
            ? !!row.item.analysisDefinition
            : kind === 'dashboard' && !row.item.analysisDefinition),
      )
      .sort((a, b) => {
        const byTitle =
          (a.item.title ?? '').localeCompare(b.item.title ?? '', 'ko') || String(a.item.id).localeCompare(String(b.item.id));
        return sort === 'title' ? byTitle : time(b.item.updatedAt) - time(a.item.updatedAt) || byTitle;
      });
  }, [items, reports, loading, listError, view, query, kind, sort]);
  const reset = () => {
    update({ artifactQuery: '', artifactKind: '', artifactSort: '' });
  };
  return (
    <section className="min-w-0 w-full" aria-labelledby="artifact-library-heading">
      <Link className="mb-4 inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" to={reportHref}>
        비공개 보고서
      </Link>
      <h2 id="artifact-library-heading" className="text-xl font-semibold tracking-tight">
        {t('artifact.heading')}
      </h2>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">{t('artifact.description')}</p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {onViewChange && (
          <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t('artifact.viewsLabel')}>
            <Button
              size="lg"
              variant={view === 'active' ? 'default' : 'outline'}
              aria-pressed={view === 'active'}
              disabled={busy}
              onClick={() => onViewChange('active')}
            >
              {t('artifact.active')}
            </Button>
            <Button
              size="lg"
              variant={view === 'archived' ? 'default' : 'outline'}
              aria-pressed={view === 'archived'}
              disabled={busy}
              onClick={() => onViewChange('archived')}
            >
              {t('artifact.archived')}
            </Button>
            {onReload && (
              <Button size="lg" variant="ghost" disabled={busy || loading} onClick={onReload}>
                {t('artifact.reload')}
              </Button>
            )}
          </div>
        )}
        <div className="ml-auto flex gap-2" role="group" aria-label={t('artifact.displayLabel')}>
          <Button
            size="lg"
            variant={display === 'list' ? 'default' : 'outline'}
            aria-pressed={display === 'list'}
            onClick={() => update({ artifactDisplay: '' })}
          >
            {t('artifact.list')}
          </Button>
          <Button
            size="lg"
            variant={display === 'grid' ? 'default' : 'outline'}
            aria-pressed={display === 'grid'}
            onClick={() => update({ artifactDisplay: 'grid' })}
          >
            {t('artifact.grid')}
          </Button>
        </div>
      </div>
      {onViewChange && <p className="mb-3 break-words text-sm text-muted-foreground">{t('artifact.archiveHelp')}</p>}
      {listError && <Notice severity="error">{t('artifact.loadFailed')}</Notice>}
      {archiveError && <Notice severity="error">{archiveError}</Notice>}
      {loading && (
        <p role="status" className="text-sm">
          {t('artifact.loading')}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          {t('artifact.busy')}
        </p>
      )}
      <div className="grid min-w-0 grid-cols-1 items-end gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_auto] [&_input]:h-10 [&_select]:h-10 [&_input]:text-base [&_select]:text-base">
        <TextField
          type="search"
          maxLength={200}
          label={t('artifact.searchLabel')}
          placeholder={t('artifact.searchPlaceholder')}
          value={query}
          onChange={event => update({ artifactQuery: event.target.value })}
        />
        <TextField
          select
          label={t('artifact.kindLabel')}
          value={kind}
          onChange={event => update({ artifactKind: event.target.value === 'all' ? '' : event.target.value })}
        >
          <option value="all">{t('artifact.all')}</option>
          <option value="analysis">{t('artifact.analysis')}</option>
          <option value="dashboard">{t('artifact.dashboard')}</option>
          <option value="report">보고서</option>
        </TextField>
        <TextField
          select
          label={t('artifact.sortLabel')}
          value={sort}
          onChange={event => update({ artifactSort: event.target.value === 'recent' ? '' : event.target.value })}
        >
          <option value="recent">{t('artifact.recent')}</option>
          <option value="title">{t('artifact.name')}</option>
        </TextField>
        <Button
          size="lg"
          variant="outline"
          className="justify-self-start"
          onClick={reset}
          disabled={!query && kind === 'all' && sort === 'recent'}
        >
          {t('artifact.reset')}
        </Button>
      </div>
      <p role="status" className="mt-3 text-xs text-muted-foreground">
        {t('artifact.count', { total: rows.length, shown: results.length })}
      </p>
      <div
        ref={reportBoundary}
        hidden={!reportsReady}
        onClickCapture={event => {
          if (!reportsReady) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {results.length ? (
          <MixedRows
            key={JSON.stringify([view, query, kind, sort, display, results.length])}
            rows={results}
            display={display}
            t={t}
            render={row =>
              row.kind === 'report' ? (
                <li
                  key={'report-' + row.item.id}
                  className={
                    display === 'grid'
                      ? 'flex min-w-0 flex-col items-start gap-4 rounded-xl border border-border bg-card p-6'
                      : 'flex min-w-0 flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-5'
                  }
                >
                  <Link
                    className={`${
                      display === 'grid' ? 'flex w-full flex-col gap-4' : 'min-w-[240px] flex-1'
                    } min-w-0 break-words font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring`}
                    aria-label={row.item.title}
                    to={navigation.link(`/reports/${row.item.id}/read`)}
                  >
                    {display === 'grid' && (
                      <span className="flex min-h-[190px] w-full flex-col justify-between rounded-lg bg-muted p-4">
                        <span className="text-xs text-muted-foreground">고정 보고서 · 버전 {row.item.version}</span>
                        <FileText aria-hidden="true" className="h-9 w-9 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">저장된 본문·KPI·차트</span>
                      </span>
                    )}
                    <span className={display === 'grid' ? 'min-h-14 text-lg leading-relaxed [word-break:keep-all]' : ''}>{row.item.title}</span>
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    보고서 · {row.item.ownership === 'owned' ? '내 보고서' : '받은 보고서'} · 버전 {row.item.version}
                  </span>
                  <time className="text-xs text-muted-foreground">{new Date(row.item.updatedAt).toLocaleString()}</time>
                </li>
              ) : (
                <BoardItem
                  key={'dashboard-' + row.item.id}
                  data={{ ...row.item, title: row.item.title ?? '', updatedAt: row.item.updatedAt ?? '' }}
                  display={display}
                  handleDeleteSelect={onDelete}
                  studioHref={row.item.analysisDefinition ? `/dashboard/${row.item.id}/studio` : undefined}
                  showStudioColumn
                  archiveAction={
                    canArchive && onArchive
                      ? {
                          label: t(row.item.library?.archived ? 'artifact.restore' : 'artifact.archive'),
                          disabled: archiveDisabled || !row.item.library,
                          onClick: () => onArchive(row.item),
                        }
                      : undefined
                  }
                />
              )
            }
          />
        ) : (
          !loading &&
          !listError && (
            <p className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">{t('artifact.empty')}</p>
          )
        )}
      </div>
    </section>
  );
}
function MixedRows<T>({
  rows,
  display,
  render,
  t,
}: {
  rows: T[];
  display: string;
  render: (row: T) => React.ReactNode;
  t: (key: string) => string;
}) {
  const [page, setPage] = useState(1);
  const count = Math.ceil(rows.length / 10);
  return (
    <>
      <ul
        aria-label={t(display === 'grid' ? 'artifact.gridLabel' : 'artifact.listLabel')}
        className={display === 'grid' ? 'mt-6 grid grid-cols-3 gap-6' : 'mt-6 grid gap-3'}
      >
        {rows.slice((page - 1) * 10, page * 10).map(render)}
      </ul>
      {count > 1 && (
        <nav aria-label="산출물 페이지" className="mt-6 flex justify-center gap-2">
          {Array.from({ length: Math.min(count, 5) }, (_, i) => Math.max(1, Math.min(page - 2, count - 4)) + i).map(
            number => (
              <Button asChild className="h-10" key={number} variant={page === number ? 'default' : 'outline'}>
                <a
                  href="#"
                  aria-current={page === number ? 'page' : undefined}
                  onClick={event => {
                    event.preventDefault();
                    setPage(number);
                  }}
                >
                  {number}
                </a>
              </Button>
            ),
          )}
        </nav>
      )}
    </>
  );
}
