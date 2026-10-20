import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import {
  MetricDeleteImpact,
  MetricDeleteRequest,
  MetricDeleteReceipt,
  fetchMetricDeleteImpact,
  submitMetricDeletion,
  metricDeletionError,
  metricDeletionDependencyLabels,
} from '@/api/metricDeletionService';

export type MetricDeleteTarget = { id: number; title: string };
type Attempt = { target: MetricDeleteTarget; body: MetricDeleteRequest; scope: string };
type Props = {
  target: MetricDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (receipt: MetricDeleteReceipt) => void;
};
const toolsClass = 'min-w-0 max-w-full whitespace-normal break-words text-sm';
export default function MetricDeleteDialog({ target, open, onOpenChange, onDeleted }: Props) {
  const [, refreshScope] = useState(0);
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
  const [impact, setImpact] = useState<{ value: MetricDeleteImpact; generation: number } | null>(null);
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
    setPending(null);
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
    setImpact(null);
    setReading(true);
    setError('');
    try {
      const value = await fetchMetricDeleteImpact(target.id, controller.signal);
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
    if (open && !frozen.current) void readImpact();
    return () => {
      abort.current?.abort();
      readGeneration.current += 1;
    };
  }, [open, target?.id, scope]);
  const confirm = async () => {
    if (writeLock.current || reading || !target || !scope || sessionBoundary.current) return;
    const existing = frozen.current;
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
    let receipt: MetricDeleteReceipt;
    try {
      receipt = await submitMetricDeletion(attempt.target.id, attempt.body);
    } catch (cause: any) {
      if (isCurrent(current, scope)) {
        setError(metricDeletionError(cause));
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
    onDeleted(receipt);
    onOpenChange(false);
  };
  const value = impact?.generation === generation.current ? impact.value : null;
  const shownTarget = pending?.target ?? (value ? target : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 max-h-[90vh] overflow-y-auto text-sm">
        <DialogTitle className="break-words pr-8">지표 삭제 영향</DialogTitle>
        <DialogDescription className="break-words">
          {sessionBoundary.current ? (
            '로그인 상태가 변경되어 이전 삭제 확인 정보를 지웠습니다. 이전 삭제가 이미 반영됐을 수 있으니 목록을 다시 확인해 주세요.'
          ) : (
            <>
              {shownTarget?.title || '선택한 지표'} · 사용처를 먼저 확인합니다. 삭제한 지표는 사용 목록에서 제외됩니다.
              연결된 자료를 자동으로 수정하거나 삭제하지 않습니다.
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
            로컬 확인 정보는 지워지며 로그인 간 요청 복구는 지원하지 않습니다. 이전 삭제가 이미 반영됐을 수 있으니 다시
            로그인한 뒤 목록을 확인해 주세요.
          </p>
        )}
        {pending && pending.target.id !== target?.id && (
          <Notice severity="warning">
            원래 대상의 미확정 요청을 보존했습니다. 같은 요청으로 원래 삭제 결과만 확인하며 새 대상은 삭제하지 않습니다.
          </Notice>
        )}
        {value && !pending && (
          <div className="min-w-0 space-y-2">
            <ul className="min-w-0 space-y-1">
              {value.dependencies.map(entry => (
                <li key={entry.kind} className="flex min-w-0 flex-wrap justify-between gap-2">
                  <span className="min-w-0 break-words">{metricDeletionDependencyLabels[entry.kind]}</span>
                  <span>{entry.count}개</span>
                </li>
              ))}
            </ul>
            {!value.canDelete && (
              <Notice severity="warning">
                사용처 설정이 남아 있어 삭제할 수 없습니다. 표시된 자료에서 지표 참조를 변경하고, 대기·실행 중 출력 작업은
                별도로 명시 취소한 뒤 사용처를 다시 읽어 주세요. 완료·실패·취소된 출력 작업의 파일과 기록은 삭제를 차단하지
                않습니다.
              </Notice>
            )}
            {value.canDelete && <p>현재 확인한 사용처가 없습니다. 삭제한 지표는 사용 목록에서 제외됩니다.</p>}
          </div>
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className={toolsClass}
            disabled={reading || writing || !!pending || !scope || sessionBoundary.current}
            onClick={() => void readImpact()}
          >
            사용처 다시 읽기
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className={toolsClass}
            disabled={reading || writing || !scope || sessionBoundary.current || (!pending && !value?.canDelete)}
            onClick={() => void confirm()}
          >
            {pending ? '같은 요청으로 삭제 결과 확인' : '지표 삭제'}
          </Button>
          <Button size="sm" variant="outline" className={toolsClass} onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
