import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { ExportJob, ExportJobRequest, ExportPayload, exportJobError, exportJobsService } from '@/api/exportJobsService';

type Props = { payload: ExportPayload; measureVersions: Record<string, number>; disabled: boolean };
const statusLabel = {
  queued: '대기',
  running: '실행 중',
  ready: '파일 준비됨',
  failed: '실패',
  cancelled: '취소됨',
  interrupted: '실행 중단',
  expired: '만료됨',
};
const buttonClass = 'min-w-0 max-w-full whitespace-normal break-words text-sm';

// Source switches remount the scoped state; condition changes keep the selected job and ambiguous request intact.
export default function ExportJobs(props: Props) {
  return <SourceExportJobs key={String(props.payload.query.sourceId)} {...props} />;
}
function SourceExportJobs({ payload, measureVersions, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [entries, setEntries] = useState<ExportJob[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [listed, setListed] = useState(false);
  const [pending, setPending] = useState<ExportJobRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mustRead, setMustRead] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const perform = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const token = generation.current;
    try {
      await action();
    } catch (err) {
      if (token === generation.current) setError(exportJobError(err));
    } finally {
      if (token === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const accept = (next: ExportJob, expectedId?: number) => {
    if (expectedId !== undefined && next.id !== expectedId) throw new Error('invalid job identity');
    setJob(next);
    setEntries(previous => previous.map(entry => (entry.id === next.id ? next : entry)));
    setMustRead(false);
  };
  const create = () => {
    if (!pending && disabled) return;
    void perform(async () => {
      // JSON copy freezes nested filters/axes as well as versions across later renders.
      const body: ExportJobRequest =
        pending ??
        JSON.parse(
          JSON.stringify({
            requestId: crypto.randomUUID(),
            payload,
            measureVersions,
          }),
        );
      setPending(body);
      const token = generation.current;
      try {
        const next = await exportJobsService.create(body);
        if (token !== generation.current) return;
        accept(next);
        setPending(null);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Explicit rejection resolves this attempt; transport loss or an invalid receipt stays frozen.
        if (token === generation.current && [400, 403, 409, 410, 422].includes(status)) setPending(null);
        throw err;
      }
    });
  };
  const list = (beforeId?: number) =>
    void perform(async () => {
      if (pending) return;
      const token = generation.current;
      const data = await exportJobsService.list(beforeId);
      if (token !== generation.current) return;
      setEntries(previous => (beforeId === undefined ? data.entries : [...previous, ...data.entries]));
      setNextBeforeId(data.nextBeforeId);
      setListed(true);
    });
  const read = (target: ExportJob) =>
    void perform(async () => {
      if (pending) return;
      const token = generation.current;
      // Failed or lost state reads must not leave stale restart/download actions enabled.
      setMustRead(true);
      const next = await exportJobsService.read(target.id);
      if (token !== generation.current) return;
      accept(next, target.id);
    });
  const mutate = (kind: 'run' | 'cancel') =>
    void perform(async () => {
      if (!job || pending || mustRead) return;
      const token = generation.current;
      setMustRead(true); // A lost write response requires an explicit state read before another mutation.
      const next = await exportJobsService[kind](job.id, job.version);
      if (token !== generation.current) return;
      accept(next, job.id);
    });
  const download = () =>
    void perform(async () => {
      if (!job || pending || mustRead) return;
      const token = generation.current;
      const { blob, filename } = await exportJobsService.file(job);
      if (token !== generation.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice('고정 CSV 파일 다운로드를 시작했습니다.');
    });
  const locked = busy || !!pending;
  return (
    <section className="min-w-0 text-sm" aria-label="영속 CSV 파일 작업">
      <Button
        size="sm"
        variant="ghost"
        className={buttonClass}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        파일 작업 {open ? '접기' : '펼치기'}
      </Button>
      {open && (
        <div className="mt-2 flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
          <p>
            접수 당시 소스·지표 버전과 조건을 고정합니다. 과거 기준의 집계 CSV이며 현재 화면 변경은 기존 작업에 적용되지
            않습니다. 최대 10,000행 / 2MiB, 접수 후 24시간.
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="outline" className={buttonClass} disabled={busy || (!pending && disabled)} onClick={create}>
              {pending ? '같은 접수 재확인' : '현재 조건으로 작업 접수'}
            </Button>
            <Button size="sm" variant="outline" className={buttonClass} disabled={locked} onClick={() => list()}>
              이전 작업 읽기
            </Button>
          </div>
          {disabled && !pending && (
            <p>유효한 결과와 지표 버전을 확인한 뒤 새 작업을 접수하세요. 이전 작업은 별도로 읽을 수 있습니다.</p>
          )}
          {pending && (
            <p role="status">
              접수 결과를 확인할 때까지 동일 UUID·조건·지표 버전을 보존합니다. 같은 접수를 재확인해 주세요.
            </p>
          )}
          {listed && entries.length === 0 && <p>조회한 작업이 없습니다.</p>}
          <ul className="flex min-w-0 flex-col gap-2">
            {entries.map(entry => (
              <li key={entry.id} className="min-w-0">
                <Button size="sm" variant="outline" className={buttonClass} disabled={locked} onClick={() => read(entry)}>
                  작업 #{entry.id} · 소스 {entry.sourceId} · {statusLabel[entry.status]}
                </Button>
              </li>
            ))}
          </ul>
          {nextBeforeId !== null && (
            <Button size="sm" variant="outline" className={buttonClass} disabled={locked} onClick={() => list(nextBeforeId)}>
              이전 20개 읽기
            </Button>
          )}
          {job && (
            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-2">
              <p className="break-words">
                작업 #{job.id} · {statusLabel[job.status]} · 버전 {job.version} · 소스 {job.sourceId} · 고정 revision{' '}
                {job.sourceRevision}
              </p>
              <p className="break-words">
                접수 {job.createdAt} · 만료 {job.expiresAt} · {job.rowCount ?? 0}행 / {job.bytes ?? 0}바이트
              </p>
              <details className="min-w-0">
                <summary>고정 조건·지표 버전 확인</summary>
                <pre className="min-w-0 whitespace-pre-wrap break-all text-sm">
                  {JSON.stringify({ payload: job.payload, measureVersions: job.measureVersions }, null, 2)}
                </pre>
              </details>
              {job.errorCode && <p className="break-words">실행 오류: {job.errorCode} · 조건과 현재 권한을 확인하세요.</p>}
              {job.status === 'running' && (
                <p>실행 상태는 선택 작업 다시 읽기로 확인하세요. 자동 조회·재실행하지 않습니다.</p>
              )}
              {job.status === 'interrupted' && (
                <p>중단된 실행은 자동으로 다시 시작하지 않습니다. 고정 기준을 확인한 뒤 CSV 만들기로 다시 실행하세요.</p>
              )}
              {job.status === 'ready' && (
                <p>이미 준비된 고정 파일입니다. 다시 실행하지 않고 고정 파일 받기로 다운로드할 수 있습니다.</p>
              )}
              {mustRead && <p>작업 상태를 다시 읽어 확인해 주세요.</p>}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className={buttonClass} disabled={locked} onClick={() => read(job)}>
                  선택 작업 다시 읽기
                </Button>
                <Button
                  className={buttonClass}
                  disabled={locked || mustRead || !['queued', 'failed', 'interrupted'].includes(job.status)}
                  onClick={() => mutate('run')}
                >
                  CSV 만들기
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={buttonClass}
                  disabled={locked || mustRead || !['queued', 'running', 'failed', 'ready'].includes(job.status)}
                  onClick={() => mutate('cancel')}
                >
                  작업 취소
                </Button>
                <Button
                  variant="outline"
                  className={buttonClass}
                  disabled={locked || mustRead || job.status !== 'ready'}
                  onClick={download}
                >
                  고정 파일 받기
                </Button>
              </div>
            </div>
          )}
          {busy && <p role="status">요청 확인 중…</p>}
          {error && <Notice severity="error">{error}</Notice>}
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </section>
  );
}
