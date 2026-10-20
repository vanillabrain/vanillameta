import React, { useEffect, useState } from 'react';
import { get } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { validateStudioDocument } from './studioDocument';
import { isTemporaryStudioId, StudioBlock, StudioDocumentV1, STUDIO_BREAKPOINTS } from './studioTypes';
type Option = { viewId: number; name: string; block: StudioBlock };
export default function StudioPivotPicker({
  document,
  disabled,
  onAdd,
}: {
  document: StudioDocumentV1;
  disabled: boolean;
  onAdd: (block: StudioBlock) => boolean;
}) {
  const [open, setOpen] = useState(false),
    [options, setOptions] = useState<Option[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const fence = captureAuthResponseFence();
    setBusy(true);
    setOptions([]);
    setSelected('');
    setError('');
    void (async () => {
      try {
        fence();
        const response = await get(`/studio/dashboards/${document.dashboardId}/pivot-options`, undefined, {
          signal: abort.signal,
        });
        fence();
        if (abort.signal.aborted) return;
        const data = response.data?.status === 'SUCCESS' ? response.data.data : response.data;
        if (!data || !Array.isArray(data.options) || data.options.length > 100) throw Error('invalid options');
        const ids = new Set();
        for (const item of data.options) {
          if (
            !Number.isSafeInteger(item.viewId) ||
            item.viewId <= 0 ||
            ids.has(item.viewId) ||
            typeof item.name !== 'string' ||
            !item.name ||
            item.name.length > 300 ||
            item.block?.kind !== 'SEGMENT_PIVOT' ||
            !isTemporaryStudioId(item.block.id)
          )
            throw Error('invalid option');
          ids.add(item.viewId);
          validateStudioDocument({
            ...document,
            blocks: [item.block],
            layouts: Object.fromEntries(STUDIO_BREAKPOINTS.map(bp => [bp, [{ id: item.block.id, x: 0, y: 0, w: 1, h: 6 }]])),
          });
        }
        setOptions(data.options);
      } catch {
        if (!abort.signal.aborted) setError('저장 Pivot을 읽지 못했습니다. 현재 초안은 유지됩니다. 다시 확인해 주세요.');
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    })();
    return () => abort.abort();
  }, [open, retry, document.dashboardId, document.sourceId, document.revision]);
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        저장 Pivot 추가
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="studio-pivot-dialog min-w-0" style={{ maxWidth: 560, width: 'calc(100vw - 2rem)' }}>
          <DialogHeader>
            <DialogTitle>저장 Pivot 추가</DialogTitle>
            <DialogDescription>
              현재 데이터의 본인 저장 Pivot을 선택합니다. 초안에 추가한 뒤 전체 미리보기와 저장이 필요합니다.
            </DialogDescription>
          </DialogHeader>
          {busy ? (
            <p role="status">저장 Pivot을 읽고 있습니다…</p>
          ) : error ? (
            <Notice severity="error">
              {error}
              <Button variant="outline" onClick={() => setRetry(n => n + 1)}>
                다시 읽기
              </Button>
            </Notice>
          ) : options.length === 0 ? (
            <p>현재 데이터에 추가할 저장 Pivot이 없습니다.</p>
          ) : (
            <TextField select label="저장한 집계 Pivot" value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="">저장 Pivot 선택</option>
              {options.map(item => (
                <option key={item.viewId} value={item.viewId}>
                  {item.name}
                </option>
              ))}
            </TextField>
          )}
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              disabled={disabled || busy || !selected}
              onClick={() => {
                const item = options.find(o => String(o.viewId) === selected);
                if (item && onAdd(JSON.parse(JSON.stringify(item.block)))) setOpen(false);
              }}
            >
              초안에 추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
