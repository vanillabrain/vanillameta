import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import BoardList from '@/components/BoardList';
import { TextField } from '@/components/ui/text-field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { LibraryView } from '@/api/personalLibraryService';

type Artifact = {
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
  const [params, setParams] = useSearchParams();
  const query = (params.get('artifactQuery') ?? '').slice(0, 200);
  const kindParam = params.get('artifactKind');
  const kind = kindParam === 'analysis' || kindParam === 'dashboard' ? kindParam : 'all';
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
  const results = useMemo(() => {
    const text = normalized(query);
    return items
      .filter(item => normalized(item.title ?? '').includes(text))
      .filter(item => kind === 'all' || (kind === 'analysis' ? !!item.analysisDefinition : !item.analysisDefinition))
      .sort((a, b) => {
        const byTitle = (a.title ?? '').localeCompare(b.title ?? '', 'ko') || String(a.id).localeCompare(String(b.id));
        return sort === 'title' ? byTitle : time(b.updatedAt) - time(a.updatedAt) || byTitle;
      });
  }, [items, query, kind, sort]);
  const reset = () => {
    update({ artifactQuery: '', artifactKind: '', artifactSort: '' });
  };
  return (
    <section className="min-w-0 w-full" aria-labelledby="artifact-library-heading">
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
      <div className="grid min-w-0 grid-cols-1 items-end gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_auto] [&_input]:h-10 [&_select]:h-10">
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
        {t('artifact.count', { total: items.length, shown: results.length })}
      </p>
      {!loading &&
        !listError &&
        (results.length ? (
          <BoardList
            key={JSON.stringify([view, query, kind, sort, results.length])}
            postList={results}
            display={display}
            handleDeleteSelect={onDelete}
            archiveActionForItem={
              canArchive && onArchive
                ? item => ({
                    label: t(item.library?.archived ? 'artifact.restore' : 'artifact.archive'),
                    disabled: archiveDisabled || !item.library,
                    onClick: () => onArchive(item),
                  })
                : undefined
            }
            studioHrefForItem={item => (item.analysisDefinition ? `/dashboard/${item.id}/studio` : undefined)}
          />
        ) : (
          <p className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">{t('artifact.empty')}</p>
        ))}
    </section>
  );
}
