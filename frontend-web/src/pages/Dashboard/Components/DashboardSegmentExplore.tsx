import React, { useState, useRef } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AggregateSegment from '@/pages/Explore/AggregateSegment';
import {
  parseExploreViewState,
  type ExploreDateRange,
  type ExploreFilter,
  type ExploreViewState,
} from '@/pages/Explore/exploreViewState';

type Item = {
  id: string;
  name: string;
  sourceId: number;
  sourceRevision: string;
  revision: string;
  state: ExploreViewState;
  dimensions: Array<{ column: string; numeric?: boolean; temporal?: boolean }>;
  measures: Array<{ id: number; label: string }>;
};
/** A local exploration session; only explicit personal-view save/add writes through existing endpoints. */
export default function DashboardSegmentExplore({
  item,
  filters,
  dateRange,
  paused,
  onReload,
}: {
  item: Item;
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  paused: boolean;
  onReload: () => void;
}) {
  const [initial, setInitial] = useState<ExploreViewState | null>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const mutationChanged = (value: boolean) => {
    pendingRef.current = value;
    setPending(value);
  };
  const close = () => {
    if (pendingRef.current) return;
    setInitial(null);
    onReload();
  };
  return (
    <>
      <Button
        variant="outline"
        disabled={paused}
        aria-label={`${item.name} 조건 다시 탐색`}
        onClick={() =>
          setInitial(
            parseExploreViewState(JSON.parse(JSON.stringify({ ...item.state, filters, dateRange: dateRange ?? null }))),
          )
        }
      >
        조건 다시 탐색
      </Button>
      <Dialog
        open={!!initial}
        onOpenChange={next => {
          if (!next) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto]"
          style={{ width: 'calc(100vw - 2rem)', maxWidth: 1100 }}
          onEscapeKeyDown={event => {
            if (pendingRef.current) event.preventDefault();
          }}
          onPointerDownOutside={event => {
            if (pendingRef.current) event.preventDefault();
          }}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            aria-label="조건 탐색 닫기"
            disabled={pending}
            onClick={close}
          >
            <XIcon />
          </Button>
          <DialogHeader className="pr-8">
            <DialogTitle>집계 조건 다시 탐색</DialogTitle>
            <DialogDescription className="break-words">
              {item.name}의 조건을 현재 필터·기간에서 수정합니다. 명시 적용 후 새 개인 보기로 저장·추가하세요. 원래 Pivot은
              바꾸지 않으며 저장하지 않은 입력은 닫으면 버립니다.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 overflow-y-auto pr-1" role="region" aria-label="집계 조건 편집 내용" tabIndex={0}>
            {initial && (
              <SegmentSession
                key={`${item.id}:${item.revision}`}
                item={item}
                initial={initial}
                onReload={close}
                onMutationPendingChange={mutationChanged}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
            {pending && (
              <p role="status" className="text-xs text-muted-foreground">
                저장 결과를 확인하는 중입니다. 완료 후 닫을 수 있습니다.
              </p>
            )}
            <Button variant="outline" disabled={pending} onClick={close}>
              탐색 닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function SegmentSession({
  item,
  initial,
  onReload,
  onMutationPendingChange,
}: {
  item: Item;
  initial: ExploreViewState;
  onReload: () => void;
  onMutationPendingChange: (pending: boolean) => void;
}) {
  const [restoration, setRestoration] = useState({ nonce: 1, state: initial });
  const current = restoration.state;
  return (
    <div className="min-w-0 space-y-2">
      <p role="status" className="break-words text-xs leading-relaxed text-muted-foreground">
        조회 범위:{' '}
        {current.dateRange
          ? `${current.dateRange.start} ~ ${current.dateRange.end} · ${current.dateRange.timeZone ?? 'UTC'}`
          : '전체 기간 · UTC'}
        {' · '}
        {current.filters.length
          ? current.filters
              .map(
                f =>
                  `${f.column}: ${
                    'values' in f
                      ? f.values.map(v => (v === null ? '(값 없음)' : String(v))).join(', ')
                      : `${f.range.min ?? '제한 없음'} ~ ${f.range.max ?? '제한 없음'}`
                  }`,
              )
              .join(' · ')
          : '필터 없음'}
      </p>
      <AggregateSegment
        sourceId={item.sourceId}
        sourceRevision={item.sourceRevision}
        catalogRevision={item.revision}
        measures={item.measures}
        dimensions={item.dimensions}
        filters={current.filters}
        dateRange={current.dateRange ?? undefined}
        grain={current.trendGrain}
        paused={false}
        restoration={restoration}
        onReloadCatalog={onReload}
        onMutationPendingChange={onMutationPendingChange}
        onRestore={state => {
          const next = parseExploreViewState(state);
          if (next.mode !== 'segment') throw new Error('이 창에서는 집계 조건 보기만 복원할 수 있습니다.');
          setRestoration(previous => ({ nonce: previous.nonce + 1, state: next }));
        }}
      />
    </div>
  );
}
