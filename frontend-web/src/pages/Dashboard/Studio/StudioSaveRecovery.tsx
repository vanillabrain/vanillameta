import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { fetchStudioDashboard, isStudioApiError, saveStudioDashboard, StudioLoadResult } from './studioApi';
import { removeStudioDocumentDraft } from './studioDocumentDraft';
import { StudioPendingSave, removeStudioPendingSave, writeStudioPendingSave } from './studioPendingSave';

export default function StudioSaveRecovery({
  dashboardId,
  title,
  documentKey,
  record,
  onResolved,
  onDraft,
}: {
  dashboardId: number;
  title?: string;
  documentKey: string | null;
  record: StudioPendingSave;
  onResolved: (latest: StudioLoadResult) => void;
  onDraft: () => void;
}) {
  const [current, setCurrent] = useState(record),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [rejected, setRejected] = useState(false);
  const alive = useRef(true),
    active = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const confirm = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError('');
    setRejected(false);
    let known = current.phase === 'confirmed';
    try {
      if (current.phase === 'pending') {
        await saveStudioDashboard(dashboardId, current.request);
        known = true;
        if (!alive.current) return;
        const confirmed = { ...current, phase: 'confirmed' as const };
        if (!writeStudioPendingSave(documentKey, confirmed))
          throw Error('저장 결과 보관에 실패했습니다. 같은 요청으로 다시 확인해 주세요.');
        setCurrent(confirmed);
      }
      const latest = await fetchStudioDashboard(dashboardId);
      if (!alive.current) return;
      // Clear the draft first: a failed marker removal keeps the confirmation gate in place.
      if (!removeStudioDocumentDraft(documentKey) || !removeStudioPendingSave(documentKey))
        throw Error('확인 기록을 정리하지 못했습니다. 다시 확인해 주세요.');
      onResolved(latest);
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : '저장 결과를 확인하지 못했습니다. 기록은 유지했습니다.');
        setRejected(!known && isStudioApiError(cause) && cause.kind === 'conflict');
      }
    } finally {
      active.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">저장 결과 확인</h1>
      <p className="break-words text-sm text-muted-foreground">{title ?? '대시보드 저장 확인'}</p>
      <Notice>
        <p>
          {current.phase === 'confirmed'
            ? '저장은 확인됐습니다. 현재 최신 저장본을 다시 불러옵니다.'
            : '이 탭에 결과를 확인하지 못한 저장 요청이 있습니다. 확인 전까지 새 편집을 시작하지 않습니다.'}
        </p>
        <p>
          {current.phase === 'confirmed'
            ? '저장을 다시 실행하지 않고 현재 최신 저장본만 조회합니다. 게시하지 않습니다.'
            : '같은 요청을 재확인합니다. 이미 저장됐다면 기존 결과를 확인하고, 미전달이었다면 저장을 완료합니다. 게시하지 않습니다.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={confirm}>
            {busy ? '확인 중…' : current.phase === 'confirmed' ? '최신 저장본 다시 조회' : '같은 저장 요청 재확인'}
          </Button>
          {rejected && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (removeStudioPendingSave(documentKey)) onDraft();
                else setError('기록을 정리하지 못했습니다. 다시 시도해 주세요.');
              }}
            >
              보관 초안으로 돌아가기
            </Button>
          )}
        </div>
      </Notice>
      {error && <Notice severity="error">{error}</Notice>}
      <p className="text-sm text-muted-foreground">
        미저장 질문은 그대로 보관합니다. 확인 후 현재 저장본에서 이어서 편집할 수 있습니다.
      </p>
    </main>
  );
}
