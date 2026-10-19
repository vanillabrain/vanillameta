import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import {
  clearReceivedRemixPending,
  readReceivedRemixPending,
  ReceivedRemixPending,
  ReceivedRemixScope,
  saveReceivedRemixPending,
} from './receivedRemixPendingStorage';
import {
  canCreateRemix,
  lookupReceivedRemixResult,
  previewRemix,
  RemixInput,
  RemixPreview,
  remixError,
  remixPreviewBlocks,
  saveRemix,
  validateRemixPreview,
} from './studioRemixApi';
import { PublishedBlockView } from './PublishedDashboard';
import { studioDateRangeSummary, studioFilterSummary } from './studioDocument';

type Props = {
  scope: ReceivedRemixScope;
  pending: ReceivedRemixPending | null;
  storageError: boolean;
  onOpen: (id: number) => void;
  onDiscard: () => void;
};
export default function ReceivedRemixRecovery(props: Props) {
  return <RecoveryPanel key={JSON.stringify([props.scope, props.pending, props.storageError])} {...props} />;
}
function RecoveryPanel({ scope, pending, storageError, onOpen, onDiscard }: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [storageFailed, setStorageFailed] = useState(storageError);
  const [found, setFound] = useState<number | null>(null),
    [missing, setMissing] = useState(false),
    [preview, setPreview] = useState<RemixPreview | null>(null);
  const [ack, setAck] = useState(false),
    [discardAck, setDiscardAck] = useState(false);
  const generation = useRef(0),
    gate = useRef(false),
    abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  const scoped = () => scope.session !== null && personalLibrarySessionScope() === scope.session;
  const reset = () => {
    setFound(null);
    setMissing(false);
    setPreview(null);
    setAck(false);
    setDiscardAck(false);
    setError('');
  };
  const run = async (action: (current: () => boolean, signal: AbortSignal) => Promise<void>) => {
    if (gate.current || !scoped()) return;
    generation.current += 1;
    abort.current?.abort();
    reset();
    gate.current = true;
    setBusy(true);
    const n = generation.current,
      controller = new AbortController();
    abort.current = controller;
    const current = () => generation.current === n && !controller.signal.aborted && scoped();
    try {
      await action(current, controller.signal);
    } catch (cause) {
      if (current())
        setError(
          (cause as any)?.response?.status === 409
            ? '원본·내 소스·저장 요청의 확인 기준이 다릅니다. 보존한 요청은 유지되며 기준을 자동 갱신하지 않습니다.'
            : remixError(cause, true),
        );
    } finally {
      if (current()) {
        gate.current = false;
        setBusy(false);
      }
    }
  };
  const check = () => {
    if (!pending) return;
    void run(async (current, signal) => {
      const result = await lookupReceivedRemixResult(pending.reference, pending.input, signal);
      if (!current()) return;
      if (result.found) setFound(result.dashboardId);
      else setMissing(true);
    });
  };
  const repeatPreview = () => {
    if (!pending || !missing) return;
    const input: RemixInput = {
      targetSourceId: pending.input.targetSourceId,
      mapping: pending.input.mapping,
      excludedBlockIds: pending.input.excludedBlockIds,
      expectedVersion: pending.input.expectedVersion,
      expectedLifecycleRevision: pending.input.expectedLifecycleRevision,
    };
    void run(async (current, signal) => {
      const report = validateRemixPreview(await previewRemix(pending.reference, input, signal), pending.reference, input);
      if (!current()) return;
      if (
        report.sourceRevision !== pending.input.expectedSourceRevision ||
        !canCreateRemix(report, pending.input.excludedBlockIds)
      )
        throw { response: { status: 409 } };
      setMissing(true);
      setPreview(report);
    });
  };
  const openCopy = (id: number) => {
    if (!scoped()) return;
    if (!clearReceivedRemixPending(scope)) {
      setStorageFailed(true);
      return;
    }
    onOpen(id);
  };
  const save = () => {
    if (!pending || !missing || !preview || !ack || storageFailed || gate.current || !scoped()) return;
    const restored = readReceivedRemixPending(scope);
    if (
      restored.error ||
      JSON.stringify(restored.pending) !== JSON.stringify(pending) ||
      !saveReceivedRemixPending(scope, pending)
    ) {
      setStorageFailed(true);
      return;
    }
    void run(async current => {
      const result = await saveRemix(pending.reference, pending.input);
      if (!current()) return;
      openCopy(result.dashboardId);
    });
  };
  const discard = () => {
    if (busy || !discardAck || !scoped()) return;
    if (!clearReceivedRemixPending(scope)) {
      setStorageFailed(true);
      return;
    }
    onDiscard();
  };
  return (
    <section aria-label="받은 분석 복제 요청 복구" className="mx-auto w-full max-w-5xl min-w-0 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">받은 분석 복제 요청 확인</h1>
      <p>
        실제로 저장을 시도한 요청만 보존했습니다. 미전송 편집 전체의 복구가 아닙니다. 새 참조나 새 요청 번호로 자동 저장하지
        않습니다.
      </p>
      {pending && (
        <div className="min-w-0 space-y-1 rounded-md border p-3">
          <p className="break-all">요청 번호: {pending.input.requestId}</p>
          <p>
            원본 번호 {scope.originId} · 내 소스 번호 {pending.input.targetSourceId} · 원본 버전{' '}
            {pending.input.expectedVersion}
          </p>
          <p>
            연결 {Object.keys(pending.input.mapping).length}개 · 제외 블록 {pending.input.excludedBlockIds.length}개
          </p>
        </div>
      )}
      {storageFailed && (
        <Notice severity="error" role="alert">
          복구 기록을 안전하게 읽거나 저장하지 못했습니다. 새 복제 저장을 차단했습니다. 보관을 해제해도 서버 요청 취소나 사본
          삭제가 되지 않습니다.
        </Notice>
      )}
      {busy && <p role="status">보존한 복제 요청을 확인하는 중…</p>}
      {error && (
        <Notice severity="error" role="alert">
          {error}
        </Notice>
      )}
      {pending && (
        <Button disabled={busy} onClick={check}>
          저장 결과 확인
        </Button>
      )}
      {found !== null && (
        <div className="space-y-2">
          <p role="status">
            이미 생성된 본인 사본을 확인했습니다. 저장 당시 영수증이며 현재 접근 권한은 서버에서 다시 검사합니다.
          </p>
          <Button disabled={busy} onClick={() => openCopy(found)}>
            내 사본 열기
          </Button>
        </div>
      )}
      {missing && (
        <div className="space-y-2">
          <p role="status">조회 시점에 저장 영수증을 찾지 못했습니다. 진행 중인 저장의 취소·미완료를 증명하지 않습니다.</p>
          <Button variant="outline" disabled={busy || storageFailed} onClick={repeatPreview}>
            보존한 조건으로 전체 미리보기
          </Button>
        </div>
      )}
      {preview && (
        <section aria-label="보존한 조건의 전체 복제 미리보기" className="min-w-0 space-y-3">
          <h2 className="font-semibold">저장 전 전체 결과 확인</h2>
          <p>{preview.title}</p>
          <p>
            {preview.mappedFilters?.length
              ? '적용 조건 · ' + studioFilterSummary(preview.mappedFilters)
              : preview.filters?.length
              ? '공통 필터의 적용 범위를 확인해 주세요.'
              : '공통 필터 없음 · 전체 범위'}
          </p>
          <p>
            {preview.mappedDateRange
              ? '적용 기간 · ' + studioDateRangeSummary(preview.mappedDateRange)
              : preview.dateRange
              ? '저장된 기간의 적용 범위를 확인해 주세요.'
              : '기간 전체'}
          </p>
          {preview.mappedConditions && <p>포함·제외 조건 적용됨 · 읽기 전용</p>}
          {!!preview.unmappedFilters?.length && (
            <Notice severity="warning">적용하지 못한 필터 열: {preview.unmappedFilters.join(', ')}</Notice>
          )}
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {remixPreviewBlocks(preview).map(block => (
              <article key={block.id} className="min-w-0 rounded-md border p-3" aria-label={block.title + ' 복제 미리보기'}>
                <PublishedBlockView block={block} />
              </article>
            ))}
          </div>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={ack} disabled={busy || storageFailed} onChange={e => setAck(e.target.checked)} />
            원래 소스 기준과 전체 미리보기를 확인했으며 같은 요청 번호·참조·입력으로 저장합니다.
          </label>
          <Button disabled={busy || storageFailed || !ack} onClick={save}>
            같은 복제 요청 저장
          </Button>
        </section>
      )}
      <details>
        <summary className="cursor-pointer">이 탭의 복제 요청 보관 해제</summary>
        <p>
          이미 서버에서 사본이 생성됐을 수 있습니다. 보관 해제는 서버 취소나 기존 사본 삭제가 아니며, 같은 요청을 확인할
          단서를 이 탭에서 지웁니다.
        </p>
        <label className="flex min-h-8 items-start gap-2">
          <input type="checkbox" checked={discardAck} disabled={busy} onChange={e => setDiscardAck(e.target.checked)} />
          서버 결과와 사본이 남을 수 있음을 이해하고 이 탭의 보관만 해제합니다.
        </label>
        <Button size="sm" variant="outline" disabled={busy || !discardAck} onClick={discard}>
          복제 요청 보관 해제
        </Button>
      </details>
      <Button asChild size="sm" variant="outline">
        <a href="/organization">받은 자료로 돌아가기</a>
      </Button>
    </section>
  );
}
