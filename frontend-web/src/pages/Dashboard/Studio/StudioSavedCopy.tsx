import React, { useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { studioRequestId, toStudioApiError } from './studioApi';
import { isTemporaryStudioId, type StudioDocumentV1 } from './studioTypes';
import { studioPivotKey } from './studioPivot';
import { validateStudioDocument } from './studioDocument';
function StudioSavedCopyDialog({
  dashboardId,
  revision,
  sourceRevision,
  disabled,
  onCopied,
  savedDocument,
}: {
  dashboardId: number;
  revision: string;
  sourceRevision: string;
  disabled: boolean;
  onCopied: (id: number) => void;
  savedDocument?: StudioDocumentV1;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copiedId, setCopiedId] = useState<number | null>(null);
  const request = useRef<{ requestId: string; expectedRevision: string; expectedSourceRevision: string } | null>(null);
  const pending = useRef(false);
  const fence = useRef<ReturnType<typeof captureAuthResponseFence> | null>(null);
  const baseline = useRef<StudioDocumentV1 | null>(null);
  const copy = async () => {
    if (disabled || pending.current || copiedId !== null) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (!fence.current) fence.current = captureAuthResponseFence();
      fence.current();
      if (!baseline.current && savedDocument) baseline.current = JSON.parse(JSON.stringify(savedDocument));
      const body = request.current ?? {
        requestId: studioRequestId(),
        expectedRevision: revision,
        expectedSourceRevision: sourceRevision,
      };
      request.current = body;
      const response = await post(`/studio/dashboards/${dashboardId}/copy`, body, { timeout: 180000 });
      fence.current();
      const value = response.data?.status === 'SUCCESS' ? response.data.data : response.data;
      const document = validateStudioDocument(value?.document);
      if (
        !Number.isSafeInteger(value.dashboardId) ||
        value.dashboardId <= 0 ||
        value.dashboardId === dashboardId ||
        document.dashboardId !== value.dashboardId ||
        !value.idMap ||
        typeof value.idMap !== 'object' ||
        Array.isArray(value.idMap)
      )
        throw Error('invalid copy');
      if (baseline.current) {
        const original = baseline.current;
        if (
          document.sourceId !== original.sourceId ||
          document.blocks.length !== original.blocks.length ||
          Object.keys(value.idMap).length !== original.blocks.length
        )
          throw Error('copy scope changed');
        for (const block of original.blocks) {
          const target = document.blocks.find(b => b.id === value.idMap[block.id]);
          if (
            !target ||
            target.kind !== block.kind ||
            target.id === block.id ||
            isTemporaryStudioId(target.id) ||
            target.title !== block.title ||
            studioPivotKey(target.pivot) !== studioPivotKey(block.pivot)
          )
            throw Error('copy recipe changed');
        }
        for (const bp of ['lg', 'md', 'xs'] as const)
          if (
            studioPivotKey(document.layouts[bp]) !==
            studioPivotKey(original.layouts[bp].map(g => ({ ...g, id: value.idMap[g.id] })))
          )
            throw Error('copy layout changed');
      }
      request.current = null;
      baseline.current = null;
      fence.current = null;
      setCopiedId(value.dashboardId);
      onCopied(value.dashboardId);
    } catch (cause) {
      const typed = toStudioApiError(cause);
      if (['conflict', 'auth', 'notFound'].includes(typed.kind)) {
        request.current = null;
        baseline.current = null;
      }
      setError(typed.message + ' 결과가 불명확하면 같은 요청으로 다시 확인하세요. 원본과 현재 초안은 유지됩니다.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        Studio 저장본 복제
      </Button>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="studio-pivot-dialog" style={{ maxWidth: 560, width: 'calc(100vw - 2rem)' }}>
          <DialogHeader>
            <DialogTitle>Studio 저장본 복제</DialogTitle>
            <DialogDescription>
              마지막 저장본을 같은 데이터로 비공개 복제합니다. 현재 미저장 변경은 제외됩니다. 새 데이터 연결과 수신자
              재사용은 아직 지원하지 않습니다.
            </DialogDescription>
          </DialogHeader>
          {error && <Notice severity="error">{error}</Notice>}
          {copiedId !== null && (
            <Notice severity="success">복사본을 만들었습니다. 원본의 미저장 변경과 질문은 이 화면에 유지됩니다.</Notice>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              닫기
            </Button>
            {copiedId !== null ? (
              <Button asChild>
                <a href={`/dashboard/${copiedId}/studio`} target="_blank" rel="noopener noreferrer">
                  복사본 Studio 새 탭에서 열기
                </a>
              </Button>
            ) : (
              <Button disabled={busy || disabled} onClick={() => void copy()}>
                {busy ? '복제 확인 중…' : request.current ? '같은 복제 요청 확인' : '저장본 복제'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// A new saved basis starts a distinct copy request and completion state.
export default function StudioSavedCopy(props: React.ComponentProps<typeof StudioSavedCopyDialog>) {
  return <StudioSavedCopyDialog key={`${props.dashboardId}:${props.revision}:${props.sourceRevision}`} {...props} />;
}
