import React, { useMemo, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('recent');
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
    setQuery('');
    setKind('all');
    setSort('recent');
  };
  return (
    <section className="min-w-0 w-full" aria-labelledby="artifact-library-heading">
      <h2 id="artifact-library-heading" className="mb-3 text-sm font-semibold">
        내 시각화 산출물
      </h2>
      {onViewChange && (
        <div className="mb-3 flex min-w-0 flex-wrap gap-2" role="group" aria-label="산출물 보관 보기">
          <Button
            size="sm"
            variant={view === 'active' ? 'default' : 'outline'}
            aria-pressed={view === 'active'}
            disabled={busy}
            onClick={() => onViewChange('active')}
          >
            기본 목록
          </Button>
          <Button
            size="sm"
            variant={view === 'archived' ? 'default' : 'outline'}
            aria-pressed={view === 'archived'}
            disabled={busy}
            onClick={() => onViewChange('archived')}
          >
            보관함
          </Button>
          {onReload && (
            <Button size="sm" variant="outline" disabled={busy || loading} onClick={onReload}>
              목록 다시 읽기
            </Button>
          )}
        </div>
      )}
      {onViewChange && (
        <p className="mb-3 break-words text-sm text-muted-foreground">
          보관은 내 목록만 바꿉니다. 원본·공유·게시·다른 사람의 목록은 유지됩니다.
        </p>
      )}
      {listError && <Notice severity="error">목록을 확인하지 못했습니다. 목록을 다시 읽어 주세요.</Notice>}
      {archiveError && <Notice severity="error">{archiveError}</Notice>}
      {loading && (
        <p role="status" className="text-sm">
          목록을 읽고 있습니다…
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          보관·복원 처리 중…
        </p>
      )}
      <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
        <TextField
          type="search"
          label="산출물 제목 검색"
          placeholder="제목으로 찾기"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <TextField select label="산출물 유형" value={kind} onChange={event => setKind(event.target.value)}>
          <option value="all">전체</option>
          <option value="analysis">분석 산출물</option>
          <option value="dashboard">일반 대시보드</option>
        </TextField>
        <TextField select label="산출물 정렬" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="recent">최근 수정순</option>
          <option value="title">이름순</option>
        </TextField>
        <Button
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={reset}
          disabled={!query && kind === 'all' && sort === 'recent'}
        >
          검색 조건 초기화
        </Button>
      </div>
      <p role="status" className="mt-3 text-xs text-muted-foreground">
        전체 {items.length}개 중 {results.length}개
      </p>
      {!loading &&
        !listError &&
        (results.length ? (
          <BoardList
            key={JSON.stringify([view, query, kind, sort, results.length])}
            postList={results}
            handleDeleteSelect={onDelete}
            archiveActionForItem={
              canArchive && onArchive
                ? item => ({
                    label: item.library?.archived ? '복원' : '보관',
                    disabled: archiveDisabled || !item.library,
                    onClick: () => onArchive(item),
                  })
                : undefined
            }
            studioHrefForItem={item => (item.analysisDefinition ? `/dashboard/${item.id}/studio` : undefined)}
          />
        ) : (
          <p className="mt-4 rounded-lg border border-border p-6 text-sm text-muted-foreground">
            조건에 맞는 산출물이 없습니다. 검색어나 유형을 바꾸거나 검색 조건을 초기화해 주세요.
          </p>
        ))}
    </section>
  );
}
