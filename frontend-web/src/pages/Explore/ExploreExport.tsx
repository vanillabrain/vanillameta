import { responseMeasureVersions } from './exploreBasis';
import React, { useEffect, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { captureAuthResponseFence } from '@/helpers/authResponseFence';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import ExportJobs from './ExportJobs';

type Props = {
  allowed?: boolean;
  measureVersions?: Record<string, number>;
  payload: { mode: 'explore' | 'pivot' | 'segment'; query: Record<string, unknown> };
  disabled: boolean;
  summary?: React.ReactNode;
};

export default function ExploreExport({ payload, disabled, summary, allowed = true, measureVersions }: Props) {
  const segment = payload.mode === 'segment';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const key = JSON.stringify([payload, measureVersions, allowed]);
  const basis = responseMeasureVersions(measureVersions, (payload.query.measureIds ?? []) as number[]);
  const blocked = disabled || (!segment && !basis);
  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    setBusy(false);
    setNotice('');
    setError('');
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [key, disabled]);

  const download = async () => {
    if (busy || blocked || !allowed) return;
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const assertSession = captureAuthResponseFence();
      assertSession();
      const response = await post(
        segment ? '/bi/explore/segments/export' : '/bi/explore/export',
        segment ? payload.query : { ...payload, query: { ...payload.query, expectedMeasureVersions: basis } },
        { signal: abort.signal },
      );
      if (token !== generation.current || abort.signal.aborted) return;
      assertSession();
      const data = response?.data?.data;
      if (response?.data?.status !== 'SUCCESS') throw new Error('invalid export response');
      if (data?.sourceRevision !== payload.query.sourceRevision)
        throw Object.assign(new Error('source revision changed'), { response: { status: 409 } });
      if (segment && data?.viewRevision !== payload.query.viewRevision)
        throw Object.assign(new Error('view revision changed'), { response: { status: 409 } });
      if (!segment) {
        const returnedBasis = responseMeasureVersions(data?.measureVersions, payload.query.measureIds as number[]);
        if (!returnedBasis || Object.keys(basis).some(id => returnedBasis[id] !== basis[id]))
          throw Object.assign(new Error('metric basis changed'), { response: { status: 409 } });
      }
      if (
        typeof data.csv !== 'string' ||
        !/^[a-zA-Z0-9_-]+\.csv$/.test(data.filename) ||
        data.mimeType !== 'text/csv;charset=utf-8' ||
        !Number.isInteger(data.rowCount) ||
        data.rowCount < 0 ||
        data.rowCount > 10000
      )
        throw new Error('invalid CSV response');
      const blob = new Blob([data.csv], { type: data.mimeType });
      if (blob.size > 2097152 || blob.size !== data.bytes) throw new Error('invalid CSV size');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = data.filename;
        document.body.appendChild(link);
        assertSession();
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice(`${data.rowCount.toLocaleString()}행 CSV 다운로드를 시작했습니다.`);
    } catch (err: any) {
      if (token !== generation.current || abort.signal.aborted) return;
      const status = err?.response?.status;
      const body = err?.response?.data;
      const detail = body?.data;
      const message = typeof detail === 'string' ? detail : detail?.message ?? body?.message;
      setError(
        status === 403 && !body
          ? '로그인 계정이 변경되었거나 조회 권한이 없습니다. 다시 확인해 주세요.'
          : status === 409
          ? segment
            ? '집계 조건 또는 지표가 변경되었습니다. 다시 적용한 뒤 내보내세요.'
            : '데이터 또는 지표 기준이 변경되었습니다. 현재 입력을 보존하고 다시 조회한 뒤 내보내세요.'
          : typeof message === 'string'
          ? message
          : 'CSV를 내보내지 못했습니다. 조건을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };

  if (!allowed) return <p className="text-xs text-muted-foreground">내보내기 권한이 없습니다.</p>;
  const trigger = (
    <Button
      variant="ghost"
      aria-label={segment ? '집계 조건 내보내기' : undefined}
      aria-expanded={open}
      onClick={() => setOpen(value => !value)}
    >
      {segment ? '표시 집계 CSV ▾' : '내보내기 ▾'}
    </Button>
  );
  return (
    <div className={summary ? 'w-full min-w-0' : segment ? 'w-full min-w-0 sm:w-auto sm:max-w-md' : 'min-w-0'}>
      {summary ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          {summary}
          {trigger}
        </div>
      ) : (
        trigger
      )}
      {open && (
        <div
          className={
            summary
              ? 'mt-2 grid min-w-0 grid-cols-1 items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]'
              : 'mt-2 flex flex-col gap-2 rounded-lg border border-border p-3'
          }
        >
          <p className="text-xs text-muted-foreground">
            {segment
              ? '적용한 집계 조건·기간·필터의 KPI, 대상 상위 50개와 시계열 최대 200점을 저장합니다. 합계는 모든 대상의 원본 행으로 다시 계산한 값입니다. 조건·단위·잘림 여부를 포함하며 원본 행은 제외합니다. Pivot을 선택했다면 표시 셀·열 합계도 포함합니다. 최대 10,000행 / 2MB.'
              : '현재 지표·축·필터·기간·비교의 집계 결과를 CSV로 저장합니다. 지표별 행 형식이며 원본 전체 행은 포함하지 않습니다. 탐색 차원 순위는 화면과 같은 상위 20개입니다. 최대 10,000행 / 2MB.'}
          </p>
          <Button variant="outline" disabled={blocked || busy} onClick={download}>
            {busy ? 'CSV 준비 중…' : 'CSV 다운로드'}
          </Button>
          {blocked && <p className="text-xs">유효한 결과를 불러온 뒤 내보내세요.</p>}
        </div>
      )}
      {payload.mode !== 'segment' && measureVersions && Array.isArray(payload.query.measureIds) && (
        <ExportJobs
          payload={{ mode: payload.mode, query: payload.query }}
          disabled={
            blocked ||
            !payload.query.measureIds.every(
              id => Number.isSafeInteger(measureVersions[String(id)]) && measureVersions[String(id)] > 0,
            ) ||
            payload.query.measureIds.length < 1 ||
            payload.query.measureIds.length > 6 ||
            payload.query.includeRows === true
          }
          measureVersions={measureVersions}
        />
      )}
      {notice && (
        <p role="status" className="text-xs">
          {notice}
        </p>
      )}
      {error && <Notice severity="error">{error}</Notice>}
    </div>
  );
}
