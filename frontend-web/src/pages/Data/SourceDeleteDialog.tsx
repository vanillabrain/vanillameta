import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import {
  SourceDeleteImpact,
  SourceDeleteRequest,
  SourceDeleteReceipt,
  fetchSourceDeleteImpact,
  submitSourceDeletion,
  sourceDeletionError,
  sourceDeletionDependencyLabels,
  fetchSourceDeletions,
  fetchSourceDeletionReceipt,
  cleanupSourceDeletion,
} from '@/api/sourceDeletionService';

export type SourceDeleteTarget = { id: number; title: string };
type Attempt = { target: SourceDeleteTarget; body: SourceDeleteRequest; scope: string };
type Props = {
  target: SourceDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (receipt: SourceDeleteReceipt) => void;
};
const toolsClass = 'min-w-0 max-w-full whitespace-normal break-words text-sm';
export default function SourceDeleteDialog({ target, open, onOpenChange, onDeleted }: Props) {
  const [, refreshScope] = useState(0);
  const queryClient = useQueryClient();
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const moreLock = useRef(false);
  const scope = personalLibrarySessionScope();
  const identity = JSON.stringify([target?.id ?? null, scope]);
  const context = useRef(identity);
  const generation = useRef(0);
  if (context.current !== identity) {
    context.current = identity;
    generation.current += 1;
  }
  const mounted = useRef(true);
  const readGeneration = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const writeLock = useRef(false);
  const writeEpoch = useRef(0);
  const session = useRef(scope);
  const handledSession = useRef(scope);
  const sessionBoundary = useRef(false);
  const [impact, setImpact] = useState<{ value: SourceDeleteImpact; generation: number } | null>(null);
  const [savedReceipt, setReceipt] = useState<{ value: SourceDeleteReceipt; scope: string } | null>(null);
  const receipt = savedReceipt?.scope === scope ? savedReceipt.value : null;
  const receiptRef = useRef(receipt);
  receiptRef.current = receipt;
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState('');
  const [storedPending, setPending] = useState<Attempt | null>(null);
  const pending = storedPending?.scope === scope ? storedPending : null;
  const frozen = useRef<Attempt | null>(null);
  // Match draft logout semantics: no cross-login recovery. Withdraw private state during render,
  // before effects close the dialog; a normal healthy token refresh keeps this scope unchanged.
  if (session.current !== scope) {
    session.current = scope;
    sessionBoundary.current = true;
    frozen.current = null;
  }
  if (!open) sessionBoundary.current = false;
  useEffect(() => {
    if (handledSession.current === scope) return;
    handledSession.current = scope;
    writeEpoch.current += 1;
    writeLock.current = false;
    setWriting(false);
    moreLock.current = false;
    setMoreLoading(false);
    setMoreError(false);
    setPending(null);
    setReceipt(null);
    setImpact(null);
    setError('');
    onOpenChange(false);
  }, [scope]);
  useEffect(() => {
    mounted.current = true;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_ACCESS_TOKEN || event.key === 'vm:editor-draft-auth:v1')
        refreshScope(value => value + 1);
    };
    window.addEventListener('storage', changed);
    return () => {
      mounted.current = false;
      generation.current += 1;
      abort.current?.abort();
      window.removeEventListener('storage', changed);
    };
  }, []);
  const isCurrent = (requestGeneration: number, requestScope: string) =>
    mounted.current && generation.current === requestGeneration && personalLibrarySessionScope() === requestScope;
  const readImpact = async () => {
    if (!target || !scope || frozen.current || writeLock.current || sessionBoundary.current) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    readGeneration.current += 1;
    const read = readGeneration.current;
    const current = generation.current;
    setReceipt(null);
    setImpact(null);
    setReading(true);
    setError('');
    try {
      const value = await fetchSourceDeleteImpact(target.id, controller.signal);
      if (controller.signal.aborted || read !== readGeneration.current || !isCurrent(current, scope)) return;
      setImpact({ value, generation: current });
    } catch {
      if (!controller.signal.aborted && read === readGeneration.current && isCurrent(current, scope))
        setError('사용처를 확인하지 못했습니다. 사용처를 다시 읽어 주세요.');
    } finally {
      if (mounted.current && read === readGeneration.current) setReading(false);
    }
  };
  useEffect(() => {
    abort.current?.abort();
    readGeneration.current += 1;
    setImpact(null);
    setReading(false);
    setError('');
    if (open && !frozen.current && !receiptRef.current) void readImpact();
    return () => {
      abort.current?.abort();
      readGeneration.current += 1;
    };
  }, [open, target?.id, scope]);
  const confirm = async () => {
    if (writeLock.current || reading || !scope || receiptRef.current || sessionBoundary.current) return;
    const existing = frozen.current;
    if (!existing && !target) return;
    const value = impact?.generation === generation.current ? impact.value : null;
    if (existing ? existing.scope !== scope : !value?.canDelete) return;
    const attempt: Attempt = existing ?? {
      target: { ...target },
      scope,
      body: Object.freeze({
        requestId: crypto.randomUUID(),
        expectedRevision: value.revision,
        expectedActorId: value.actorId,
        expectedOrganizationId: value.organizationId,
      }),
    };
    frozen.current = attempt;
    setPending(attempt);
    writeLock.current = true;
    setWriting(true);
    setError('');
    const current = generation.current;
    writeEpoch.current += 1;
    const operation = writeEpoch.current;
    let receipt: SourceDeleteReceipt;
    try {
      receipt = await submitSourceDeletion(attempt.target.id, attempt.body);
    } catch (cause: any) {
      if (isCurrent(current, scope)) {
        setError(sourceDeletionError(cause));
        if (cause?.response?.status === 409) {
          frozen.current = null;
          setPending(null);
          setImpact(null);
        }
      }
      return;
    } finally {
      if (operation === writeEpoch.current) {
        writeLock.current = false;
        if (mounted.current) setWriting(false);
      }
    }
    if (!isCurrent(current, scope)) return;
    frozen.current = null;
    setPending(null);
    setImpact(null);
    setReceipt({ value: receipt, scope });
    onDeleted(receipt);
    if (!receipt.replayed && receipt.cleanup.managedFiles === 0 && receipt.cleanup.status === 'complete')
      onOpenChange(false);
  };
  const history = useQuery({
    queryKey: ['sourceDeletions', scope],
    enabled: false,
    retry: false,
    queryFn: async ({ signal }) => {
      const value = await fetchSourceDeletions(signal);
      if (signal.aborted || !mounted.current || personalLibrarySessionScope() !== scope) throw new Error('session changed');
      return value;
    },
  });
  const loadMore = async () => {
    const previous = history.data;
    const beforeId = previous?.nextBeforeId;
    if (
      !scope ||
      !beforeId ||
      moreLock.current ||
      history.isFetching ||
      writeLock.current ||
      frozen.current ||
      sessionBoundary.current
    )
      return;
    moreLock.current = true;
    setMoreLoading(true);
    setMoreError(false);
    try {
      const value = await queryClient.fetchQuery({
        queryKey: ['sourceDeletions', scope, beforeId],
        staleTime: 0,
        retry: false,
        queryFn: async ({ signal }) => {
          const page = await fetchSourceDeletions(signal, beforeId);
          if (signal.aborted || !mounted.current || personalLibrarySessionScope() !== scope)
            throw new Error('session changed');
          return page;
        },
      });
      if (!mounted.current || personalLibrarySessionScope() !== scope) return;
      if (
        value.actorId !== previous.actorId ||
        value.organizationId !== previous.organizationId ||
        value.entries.some(entry =>
          previous.entries.some(old => old.receiptId === entry.receiptId || old.requestId === entry.requestId),
        )
      )
        throw new Error('history scope changed');
      queryClient.setQueryData(['sourceDeletions', scope], { ...value, entries: [...previous.entries, ...value.entries] });
    } catch {
      if (mounted.current && personalLibrarySessionScope() === scope) setMoreError(true);
    } finally {
      if (mounted.current && personalLibrarySessionScope() === scope) {
        moreLock.current = false;
        setMoreLoading(false);
      }
    }
  };
  const loadReceipt = async (selected: SourceDeleteReceipt) => {
    if (!scope || writeLock.current || frozen.current || reading || sessionBoundary.current) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    readGeneration.current += 1;
    const read = readGeneration.current;
    const current = generation.current;
    setReceipt(null);
    setImpact(null);
    setReading(true);
    setError('');
    try {
      const value = await fetchSourceDeletionReceipt(selected, controller.signal);
      if (!controller.signal.aborted && read === readGeneration.current && isCurrent(current, scope))
        setReceipt({ value, scope });
    } catch {
      if (!controller.signal.aborted && read === readGeneration.current && isCurrent(current, scope))
        setError('파일 정리 기록을 확인하지 못했습니다. 기록을 다시 읽어 주세요.');
    } finally {
      if (mounted.current && read === readGeneration.current) setReading(false);
    }
  };
  const cleanup = async () => {
    const selected = receiptRef.current;
    if (
      !scope ||
      !selected ||
      selected.cleanup.status === 'complete' ||
      writeLock.current ||
      reading ||
      sessionBoundary.current
    )
      return;
    writeLock.current = true;
    setWriting(true);
    setError('');
    const current = generation.current;
    writeEpoch.current += 1;
    const operation = writeEpoch.current;
    try {
      const value = await cleanupSourceDeletion(selected);
      if (isCurrent(current, scope)) setReceipt({ value, scope });
    } catch {
      if (isCurrent(current, scope))
        setError('파일 정리 결과를 확인하지 못했습니다. 같은 영수증의 파일 정리를 명시적으로 다시 확인해 주세요.');
    } finally {
      if (operation === writeEpoch.current) {
        writeLock.current = false;
        if (mounted.current) setWriting(false);
      }
    }
  };
  const value = impact?.generation === generation.current ? impact.value : null;
  const shownTarget = pending?.target ?? (value ? target : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 max-h-[90vh] overflow-y-auto text-sm">
        <DialogTitle className="break-words pr-8">소스 삭제 영향</DialogTitle>
        <DialogDescription className="break-words">
          {sessionBoundary.current ? (
            '로그인 상태가 변경되어 이전 삭제 확인 정보를 지웠습니다. 이전 삭제가 이미 반영됐을 수 있으니 목록을 다시 확인해 주세요.'
          ) : (
            <>
              {shownTarget?.title || '선택한 소스'} · 먼저 소스 연결 정보를 영구 삭제합니다. 관리 파일은 삭제 확정 후 별도
              파일 정리 버튼으로 처리합니다. 외부 DB 원본과 연결된 자료는 자동으로 삭제하지 않습니다.
            </>
          )}
        </DialogDescription>
        {error && <Notice severity="error">{error}</Notice>}
        {!scope && <Notice severity="warning">로그인한 계정을 확인해 주세요.</Notice>}
        {reading && <p role="status">사용처 확인 중…</p>}
        {writing && <p role="status">삭제 결과 확인 중…</p>}
        {pending && (
          <p role="status" className="break-words">
            삭제 결과가 확정될 때까지 같은 요청 번호와 기준을 보존합니다. 자동 재요청하지 않습니다. 새 로그인·로그아웃 시
            로컬 확인 정보는 지워지며 미확정 삭제 요청의 로그인 간 복구는 지원하지 않습니다. 확정된 파일 정리 기록은 로그인
            후 명시적으로 다시 읽을 수 있습니다.
          </p>
        )}
        {pending && pending.target.id !== target?.id && (
          <Notice severity="warning">
            원래 대상의 미확정 요청을 보존했습니다. 같은 요청으로 원래 삭제 결과만 확인하며 새 대상은 삭제하지 않습니다.
          </Notice>
        )}
        {value && !pending && (
          <div className="min-w-0 space-y-2">
            <p>정리 대상 관리 파일 {value.managedFileCount}개</p>
            <ul className="min-w-0 space-y-1">
              {value.dependencies.map(entry => (
                <li key={entry.kind} className="flex min-w-0 flex-wrap justify-between gap-2">
                  <span className="min-w-0 break-words">{sourceDeletionDependencyLabels[entry.kind]}</span>
                  <span>{entry.count}개</span>
                </li>
              ))}
            </ul>
            {!value.canDelete && (
              <Notice severity="warning">
                사용처 설정이 남아 있어 삭제할 수 없습니다. 자료 참조·권한·게시를 별도로 정리하고 대기·실행 중 출력 작업을
                명시 취소한 뒤 다시 읽어 주세요. 미만료 완료 출력 파일과 다른 소스의 파일 참조도 삭제를 차단합니다. 완료 출력
                파일은 만료 상태를 확인해 주세요.
              </Notice>
            )}
            {value.canDelete && (
              <p>현재 확인한 사용처가 없습니다. 소스 연결 정보를 영구 삭제하며 파일 정리는 별도로 실행합니다.</p>
            )}
          </div>
        )}
        {receipt && (
          <div className="min-w-0 space-y-2" role="status">
            <p>
              소스 #{receipt.sourceId} 연결 정보 삭제 확정 · 영수증 #{receipt.receiptId}
            </p>
            <p>
              관리 파일 {receipt.cleanup.managedFiles}개 ·{' '}
              {receipt.cleanup.status === 'complete'
                ? '파일 정리 완료'
                : receipt.cleanup.status === 'retry_required'
                ? '파일 정리 재시도 필요'
                : '파일 정리 대기 중'}
            </p>
            {receipt.cleanup.status === 'pending' && <p>다른 정리가 진행 중일 수도 있습니다. 자동 재시도하지 않습니다.</p>}
            <Button
              size="sm"
              className={toolsClass}
              disabled={writing || reading || !scope || sessionBoundary.current || receipt.cleanup.status === 'complete'}
              onClick={() => void cleanup()}
            >
              파일 정리
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={toolsClass}
              disabled={writing || reading || !scope || sessionBoundary.current}
              onClick={() => void loadReceipt(receipt)}
            >
              정리 상태 다시 읽기
            </Button>
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <Button
            size="sm"
            variant="outline"
            className={toolsClass}
            disabled={
              !scope || reading || writing || !!pending || history.isFetching || moreLoading || sessionBoundary.current
            }
            onClick={() => {
              setMoreError(false);
              void history.refetch();
            }}
          >
            파일 정리 기록 읽기
          </Button>
          {(history.isFetching || moreLoading) && <p role="status">파일 정리 기록 확인 중…</p>}
          {(history.isError || moreError) && (
            <Notice severity="error">파일 정리 기록을 읽지 못했습니다. 다시 읽어 주세요.</Notice>
          )}
          {!history.isError && !moreError && !history.isFetching && !sessionBoundary.current && history.data && (
            <ul className="min-w-0 space-y-2">
              {history.data.entries.length === 0 && <li>미완료 파일 정리 기록이 없습니다.</li>}
              {history.data.entries.map(entry => (
                <li key={entry.receiptId} className="flex min-w-0 flex-wrap items-center gap-2">
                  <span>
                    소스 #{entry.sourceId} · 영수증 #{entry.receiptId}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className={toolsClass}
                    disabled={writing || reading || !!pending || !scope}
                    onClick={() => void loadReceipt(entry)}
                  >
                    영수증 #{entry.receiptId} 확인
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!history.isError && !moreError && history.data?.nextBeforeId && !sessionBoundary.current && (
            <Button
              size="sm"
              variant="outline"
              className={toolsClass}
              disabled={reading || writing || !!pending || history.isFetching || moreLoading || !scope}
              onClick={() => void loadMore()}
            >
              이전 파일 정리 기록 더 읽기
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className={toolsClass}
            disabled={reading || writing || !!pending || !target || !scope || sessionBoundary.current}
            onClick={() => void readImpact()}
          >
            사용처 다시 읽기
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className={toolsClass}
            disabled={
              reading || writing || !!receipt || !scope || sessionBoundary.current || (!pending && !value?.canDelete)
            }
            onClick={() => void confirm()}
          >
            {pending ? '같은 요청으로 삭제 결과 확인' : '소스 삭제'}
          </Button>
          <Button size="sm" variant="outline" className={toolsClass} onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
