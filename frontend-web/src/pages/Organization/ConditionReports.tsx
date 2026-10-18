import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { assertOrganizationRequest, orgGet, orgPost, organizationError, ViewCatalog } from './governanceApi';
const outcomes = {
  matched: '조건 충족 · 앱 안 알림',
  not_matched: '조건 미달 · 알림 없음',
  failed: '조회 실패 · 알림 없음',
  stale: '분석·접근 범위 변경 · 알림 없음',
  denied: '권한 제한 · 알림 없음',
};
export function validateReports(rows: any, catalog: ViewCatalog): any[] {
  if (!Array.isArray(rows) || rows.length > 20) throw new Error('예약 보고 응답을 확인하지 못했습니다.');
  for (const job of rows) {
    if (
      !job ||
      typeof job.id !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(job.id) ||
      typeof job.active !== 'boolean' ||
      !Number.isSafeInteger(job.version) ||
      typeof job.restricted !== 'boolean' ||
      !Number.isFinite(Date.parse(job.nextAt)) ||
      !Array.isArray(job.records) ||
      job.records.length > 5
    )
      throw new Error('예약 보고 응답을 확인하지 못했습니다.');
    if (job.restricted) {
      if (job.records.length) throw new Error('접근할 수 없는 과거 보고입니다.');
      continue;
    }
    if (
      !catalog.blocks.some(b => b.id === job.blockId) ||
      typeof job.title !== 'string' ||
      typeof job.threshold !== 'string' ||
      !/^-?\d{1,30}(?:\.\d{1,12})?$/.test(job.threshold)
    )
      throw new Error('허용된 예약을 확인해 주세요.');
    for (const record of job.records) {
      if (!record || !Number.isFinite(Date.parse(record.scheduledAt)) || !Object.hasOwn(outcomes, record.outcome))
        throw new Error('보고 이력을 확인하지 못했습니다.');
      if (['matched', 'not_matched'].includes(record.outcome)) {
        const r = record.result;
        if (
          !r ||
          r.viewRevision !== catalog.viewRevision ||
          typeof r.title !== 'string' ||
          !(
            (typeof r.value === 'number' && Number.isFinite(r.value)) ||
            (typeof r.value === 'string' &&
              r.value.length <= 4096 &&
              /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(r.value))
          ) ||
          !Number.isFinite(Date.parse(r.queriedAt))
        )
          throw new Error('현재 접근 범위의 보고를 확인하지 못했습니다.');
      } else if (record.result) throw new Error('실패한 조회의 숫자를 표시할 수 없습니다.');
    }
  }
  return rows;
}
export default function ConditionReports({
  orgId,
  dashboardId,
  catalog,
}: {
  orgId: number;
  dashboardId: number;
  catalog: ViewCatalog;
}) {
  const root = `/${orgId}/dashboards/${dashboardId}/reports`;
  const [jobs, setJobs] = useState<any[]>([]),
    [block, setBlock] = useState(''),
    [operator, setOperator] = useState('gt'),
    [threshold, setThreshold] = useState(''),
    [interval, setIntervalValue] = useState('3600');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState<any>(null);
  const controller = useRef<AbortController | null>(null),
    seq = useRef(0),
    running = useRef(false);
  const load = async (signal: AbortSignal) => {
    const value = validateReports(await orgGet(root, signal), catalog);
    if (signal.aborted) return;
    assertOrganizationRequest(signal);
    setJobs(value);
  };
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(false);
    setJobs([]);
    setBlock('');
    setThreshold('');
    setPending(null);
    setError('');
    setMessage('');
    void load(abort.signal).catch(e => {
      if (!abort.signal.aborted) setError(organizationError(e));
    });
    return () => {
      seq.current += 1;
      abort.abort();
      controller.current?.abort();
      running.current = false;
    };
  }, [root, catalog.viewRevision]);
  const run = async (fn: (signal: AbortSignal) => Promise<void>) => {
    if (running.current) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    seq.current += 1;
    const token = seq.current;
    running.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn(abort.signal);
    } catch (e) {
      if (!abort.signal.aborted && seq.current === token) {
        setJobs([]);
        setError(organizationError(e));
      }
    } finally {
      if (seq.current === token) {
        setBusy(false);
        running.current = false;
      }
    }
  };
  const create = () =>
    run(async signal => {
      const body = pending ?? {
        requestId: crypto.randomUUID(),
        viewRevision: catalog.viewRevision,
        blockId: block,
        operator,
        threshold,
        intervalSeconds: Number(interval),
      };
      setPending(body);
      const value = await orgPost(root, body, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      if (value?.id !== body.requestId) throw new Error('예약 결과를 확인하지 못했습니다.');
      setPending(null);
      await load(signal);
      assertOrganizationRequest(signal);
      setMessage('본인에게만 전달할 예약을 저장했습니다. 첫 확인은 지금 실행할 수 있습니다.');
    });
  const check = (id: string) =>
    run(async signal => {
      await orgPost(root + '/' + id + '/evaluate', {}, signal);
      await load(signal);
      assertOrganizationRequest(signal);
      setMessage('도래한 예약을 확인했습니다. 같은 발생 시점은 중복 기록하지 않습니다.');
    });
  const stop = (j: any) =>
    run(async signal => {
      await orgPost(root + '/' + j.id + '/stop', { expectedVersion: j.version }, signal);
      await load(signal);
      assertOrganizationRequest(signal);
      setMessage('예약을 중지했습니다.');
    });
  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4" aria-label="내 조건 보고·알림">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">내 조건 보고·알림</h2>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(load)}>
          기록 다시 확인
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        본인에게만 앱 안에서 알립니다. 현재 조직 범위의 전체 기간 숫자 지표를 새로 조회합니다. 화면 필터는 예약에 저장하지
        않습니다. 메일·외부 메시지는 발송하지 않습니다.
      </p>
      {error && <Notice severity="error">{error}</Notice>}
      {message && <Notice severity="info">{message}</Notice>}
      {catalog.capabilities.export ? (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <TextField
              label="보고할 숫자 지표"
              select
              value={block}
              disabled={busy || !!pending}
              onChange={e => setBlock(e.target.value)}
            >
              <option value="">지표 선택</option>
              {catalog.blocks
                .filter(b => b.kind === 'BOARD_NUMERIC')
                .map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </TextField>
            <TextField
              label="조건"
              select
              value={operator}
              disabled={busy || !!pending}
              onChange={e => setOperator(e.target.value)}
            >
              <option value="gt">임계값 초과</option>
              <option value="lt">임계값 미만</option>
            </TextField>
            <TextField
              label="임계값"
              inputMode="decimal"
              value={threshold}
              disabled={busy || !!pending}
              onChange={e => setThreshold(e.target.value)}
            />
            <TextField
              label="확인 주기"
              select
              value={interval}
              disabled={busy || !!pending}
              onChange={e => setIntervalValue(e.target.value)}
            >
              <option value="60">1분</option>
              <option value="300">5분</option>
              <option value="3600">1시간</option>
              <option value="86400">24시간</option>
            </TextField>
          </div>
          <Button
            disabled={busy || (!pending && (!block || !threshold.trim() || !/^-?\d{1,30}(?:\.\d{1,12})?$/.test(threshold)))}
            onClick={() => void create()}
          >
            {pending ? '같은 예약 저장 확인' : '본인 수신 예약 저장'}
          </Button>
          {pending && !busy && (
            <Notice severity="info">
              저장 결과가 확정되지 않았습니다. 입력을 유지하고 같은 요청으로 확인하세요. 새로고침 후 자동 저장하지 않습니다.
            </Notice>
          )}
        </>
      ) : (
        <Notice severity="info">집계 보관이 허용된 그룹에서 예약 보고를 사용할 수 있습니다.</Notice>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          예약과 현재 접근 범위를 확인합니다…
        </p>
      )}
      <ul className="space-y-3">
        {jobs.map(j => (
          <li key={j.id} className="min-w-0 space-y-3 rounded-lg border p-3">
            {j.restricted ? (
              <Notice severity="info">
                접근 범위가 바뀌어 이전 보고의 숫자를 숨겼습니다. 권한을 확인하고 새로 예약하세요.
              </Notice>
            ) : (
              <>
                <h3 className="break-words text-sm font-medium">
                  {j.title} · {j.operator === 'gt' ? '초과' : '미만'} {j.threshold}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {j.active ? `예약 중 · 다음 확인 ${j.nextAt}` : '중지됨'} · {j.intervalSeconds}초 간격
                </p>
                <ul className="space-y-2">
                  {j.records.map(r => (
                    <li key={r.scheduledAt} className="space-y-1 rounded-md bg-muted/30 p-3 text-sm">
                      <p className="font-medium">{outcomes[r.outcome]}</p>
                      {r.result && (
                        <p className="break-words text-lg font-semibold tabular-nums">
                          {typeof r.result.value === 'number'
                            ? r.result.value.toLocaleString(undefined, { maximumFractionDigits: 6 })
                            : r.result.value}{' '}
                          {typeof r.result.display?.suffix === 'string' ? r.result.display.suffix : ''}
                        </p>
                      )}
                      <p className="break-words text-xs text-muted-foreground">
                        {r.result ? '최신 성공 조회 ' + r.result.queriedAt : '예약 발생 ' + r.scheduledAt}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {j.active && (
                <>
                  <Button variant="outline" size="sm" disabled={busy || j.restricted} onClick={() => void check(j.id)}>
                    도래한 예약 확인
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void stop(j)}>
                    예약 중지
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
