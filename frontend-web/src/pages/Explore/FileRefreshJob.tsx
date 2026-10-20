import React, { useEffect, useRef, useState } from 'react';
import { get, post, postForm } from '@/helpers/apiHelper';
import { getToken } from '@/helpers/authHelper';
import { editorDraftKey } from '@/helpers/editorDraftStorage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import FileSchemaChange from './FileSchemaChange';
import FileSchemaImpact from './FileSchemaImpact';

type Status = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled';
type Job = {
  id: string;
  sourceId: number;
  requestId: string;
  originalname: string;
  status: Status;
  attempts: number;
  storageAvailable?: boolean;
  cleanupPending?: boolean;
  correction?: { keyColumn: string; updatedAtColumn: string };
  result?: any;
  error?: { code: string; message: string; changes?: unknown };
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const labels: Record<Status, string> = {
  queued: '대기 중',
  running: '파일 검증·갱신 중',
  succeeded: '갱신 완료',
  failed: '갱신 실패 · 기존 데이터 유지',
  interrupted: '실행 연결 끊김 · 기존 데이터 유지',
  cancelled: '취소됨 · 기존 데이터 유지',
};
function validCorrectionConfig(value: any): value is { keyColumn: string; updatedAtColumn: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'keyColumn,updatedAtColumn' &&
    ['keyColumn', 'updatedAtColumn'].every(
      key => typeof value[key] === 'string' && !!value[key].trim() && value[key].length <= 128,
    ) &&
    value.keyColumn !== value.updatedAtColumn
  );
}
function unwrap(response: any, sourceId: number, expected?: string): Job | null {
  if (response?.data?.status !== 'SUCCESS') throw new Error('작업 응답을 확인하지 못했습니다.');
  const job = response.data.data;
  if (job === null && !expected) return null;
  if (
    !job ||
    job.sourceId !== sourceId ||
    !UUID.test(job.id) ||
    !UUID.test(job.requestId) ||
    (expected && expected !== job.requestId) ||
    !Object.prototype.hasOwnProperty.call(labels, job.status) ||
    typeof job.originalname !== 'string' ||
    job.originalname.length > 256 ||
    !Number.isInteger(job.attempts) ||
    job.attempts < 0 ||
    job.attempts > 3 ||
    (job.error !== undefined &&
      (!job.error ||
        typeof job.error.code !== 'string' ||
        typeof job.error.message !== 'string' ||
        job.error.message.length > 2000))
  )
    throw new Error('현재 소스의 갱신 작업을 확인하지 못했습니다.');
  if (
    job.status === 'succeeded' &&
    (!job.result ||
      job.result.sourceId !== sourceId ||
      typeof job.result.revision !== 'string' ||
      !Array.isArray(job.result.versions))
  )
    throw new Error('갱신 완료 버전을 확인하지 못했습니다.');
  if (job.correction !== undefined && !validCorrectionConfig(job.correction))
    throw new Error('이 갱신 작업의 정정 설정을 확인하지 못했습니다.');
  const stats = job.result?.correctionStats;
  if (
    stats !== undefined &&
    (!stats ||
      [
        'rows',
        'inputRows',
        'duplicateRowsDropped',
        'supersededRows',
        'inserted',
        'updated',
        'identical',
        'ignoredOlder',
      ].some(key => !Number.isSafeInteger(stats[key]) || stats[key] < 0) ||
      typeof stats.unchanged !== 'boolean')
  )
    throw new Error('정정 결과의 처리 건수를 확인하지 못했습니다.');
  return job;
}
const message = (error: any) => {
  const body = error?.response?.data;
  const text = body?.message ?? (typeof body?.data === 'string' ? body.data : undefined);
  if (typeof text === 'string') return text;
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')
    return '서버에 연결하지 못했습니다. 입력과 기존 성공 데이터는 유지됩니다. 연결이 복구되면 같은 갱신 요청을 확인해 주세요.';
  return error?.message || '갱신 작업을 확인하지 못했습니다.';
};
/** No POST on mount/reload. Only explicit submit/retry can start or repeat an import. */
export default function FileRefreshJob({
  sourceId,
  revision,
  disabled,
  onCompleted,
  onLockedChange,
  columns = [],
  allowCorrection = false,
}: {
  sourceId: number;
  revision: string;
  disabled?: boolean;
  columns?: Array<{ name: string; type: string }>;
  allowCorrection?: boolean;
  onCompleted: (result: any) => void;
  onLockedChange: (value: boolean) => void;
}) {
  const [correctionEnabled, setCorrectionEnabled] = useState(false),
    [keyColumn, setKeyColumn] = useState(''),
    [updatedAtColumn, setUpdatedAtColumn] = useState('');
  const configRestored = useRef(false);
  const requestCorrection = useRef<{ keyColumn: string; updatedAtColumn: string } | null>(null);
  const keyColumns = columns.filter(c =>
    /^(?:VARCHAR|CHAR|U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|UUID)(?:\(\d+\))?$/.test(c.type.toUpperCase()),
  );
  const timeColumns = columns.filter(c => /^(?:DATE|TIMESTAMP(?:_MS|_NS|_S| WITH TIME ZONE)?)$/.test(c.type.toUpperCase()));
  const invalidCorrection =
    correctionEnabled &&
    (!allowCorrection ||
      !keyColumns.some(c => c.name === keyColumn) ||
      !timeColumns.some(c => c.name === updatedAtColumn) ||
      keyColumn === updatedAtColumn);
  const [job, setJob] = useState<Job | null>(null),
    [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true),
    [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false),
    [missing, setMissing] = useState(false);
  const requestId = useRef<string | null>(null),
    key = useRef<string | null>(null),
    sequence = useRef(0),
    pending = useRef(false),
    delivered = useRef('');
  const pollStarted = useRef(0);
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    completed = useRef(onCompleted);
  completed.current = onCompleted;
  const base = `/database/${sourceId}/file-refreshes`;
  const active = !!job && ['queued', 'running'].includes(job.status);
  const unresolved = !!job && ['queued', 'running', 'failed', 'interrupted'].includes(job.status);
  const locked = busy || checking || unresolved || unknown;
  useEffect(() => {
    onLockedChange(locked);
    return () => onLockedChange(false);
  }, [locked, onLockedChange]);
  const removeRecord = () => {
    if (key.current) {
      try {
        sessionStorage.removeItem(key.current);
      } catch {
        /* server receipt still proves the result */
      }
    }
  };
  const apply = (next: Job | null, notify: boolean) => {
    if (
      next &&
      requestId.current === next.requestId &&
      requestCorrection.current &&
      (next.correction?.keyColumn !== requestCorrection.current.keyColumn ||
        next.correction?.updatedAtColumn !== requestCorrection.current.updatedAtColumn)
    )
      throw new Error('요청한 정정 설정과 서버 작업이 다릅니다. 파일을 다시 전송하지 말고 같은 요청을 확인해 주세요.');
    setJob(next);
    if (!configRestored.current && next) {
      configRestored.current = true;
      if (next.correction) {
        setCorrectionEnabled(true);
        setKeyColumn(next.correction.keyColumn);
        setUpdatedAtColumn(next.correction.updatedAtColumn);
      }
    }
    setUnknown(false);
    setMissing(false);
    if (next && ['queued', 'running'].includes(next.status)) {
      if (!pollStarted.current || requestId.current !== next.requestId) pollStarted.current = Date.now();
    } else pollStarted.current = 0;
    if (!next) return;
    requestId.current = next.requestId;
    if (['succeeded', 'cancelled'].includes(next.status)) removeRecord();
    if (next.status === 'cancelled') {
      setFile(null);
      if (input.current) input.current.value = '';
    }
    if (next.status === 'succeeded' && notify && delivered.current !== next.id) {
      delivered.current = next.id;
      setFile(null);
      if (input.current) input.current.value = '';
      completed.current(next.result);
    }
  };
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current,
      abort = new AbortController();
    controller.current = abort;
    pending.current = false;
    setJob(null);
    configRestored.current = false;
    requestCorrection.current = null;
    setCorrectionEnabled(false);
    setKeyColumn('');
    setUpdatedAtColumn('');
    setFile(null);
    setError('');
    setUnknown(false);
    setMissing(false);
    setChecking(true);
    setBusy(false);
    requestId.current = null;
    delivered.current = '';
    void (async () => {
      try {
        const authKey = await editorDraftKey(getToken(), sourceId);
        if (token !== sequence.current) return;
        key.current = authKey ? authKey + ':file-refresh' : null;
        let saved: any;
        try {
          const raw = key.current && sessionStorage.getItem(key.current);
          saved = raw && raw.length <= 1024 ? JSON.parse(raw) : null;
        } catch {
          saved = null;
        }
        if (token !== sequence.current) return;
        const valid =
          saved?.version === 1 &&
          saved?.sourceId === sourceId &&
          UUID.test(saved.requestId) &&
          Number.isFinite(saved.updatedAt) &&
          Date.now() - saved.updatedAt < 86400000 &&
          saved.updatedAt <= Date.now() + 60000;
        requestId.current = valid ? saved.requestId : null;
        if (valid && validCorrectionConfig(saved.correction)) {
          requestCorrection.current = saved.correction;
          setCorrectionEnabled(true);
          setKeyColumn(saved.correction.keyColumn);
          setUpdatedAtColumn(saved.correction.updatedAtColumn);
        }
        const response = await get(valid ? `${base}/${saved.requestId}` : `${base}/latest`, undefined, {
          signal: abort.signal,
        });
        if (token !== sequence.current || abort.signal.aborted) return;
        apply(unwrap(response, sourceId, valid ? saved.requestId : undefined), !!valid);
      } catch (failure: any) {
        if (token !== sequence.current || abort.signal.aborted) return;
        setError(message(failure));
        setUnknown(true);
        setMissing(!!requestId.current && failure?.response?.status === 404);
      } finally {
        if (token === sequence.current) setChecking(false);
      }
    })();
    return () => {
      sequence.current += 1;
      abort.abort();
      controller.current?.abort();
      pending.current = false;
    };
  }, [sourceId]);
  const read = async (automatic = false) => {
    if (pending.current) return;
    const token = sequence.current,
      abort = new AbortController();
    controller.current = abort;
    pending.current = true;
    if (!automatic) {
      setBusy(true);
      pollStarted.current = Date.now();
    }
    try {
      const response = await get(requestId.current ? `${base}/${requestId.current}` : `${base}/latest`, undefined, {
        signal: abort.signal,
      });
      if (token !== sequence.current || abort.signal.aborted) return;
      apply(unwrap(response, sourceId, requestId.current ?? undefined), true);
      setError('');
    } catch (failure: any) {
      if (token === sequence.current && !abort.signal.aborted) {
        setError(message(failure));
        setUnknown(true);
        setMissing(!!requestId.current && failure?.response?.status === 404);
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (!active || unknown || Date.now() - pollStarted.current >= 60000) return;
    const timer = setTimeout(() => void read(true), 1500);
    return () => clearTimeout(timer);
  }, [job, active, unknown]);
  const submit = async () => {
    if (pending.current || !file || disabled || locked || invalidCorrection) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const token = sequence.current,
      abort = new AbortController();
    controller.current = abort;
    const id = crypto.randomUUID();
    let prepared = false;
    try {
      if (!key.current) throw new Error('로그인 세션의 갱신 복구 기록을 준비하지 못했습니다. 요청은 전송하지 않았습니다.');
      sessionStorage.setItem(
        key.current,
        JSON.stringify({
          version: 1,
          updatedAt: Date.now(),
          sourceId,
          requestId: id,
          ...(correctionEnabled ? { correction: { keyColumn, updatedAtColumn } } : {}),
        }),
      );
      requestId.current = id;
      requestCorrection.current = correctionEnabled ? { keyColumn, updatedAtColumn } : null;
      prepared = true;
      setJob(null);
      pollStarted.current = 0;
      const form = new FormData();
      form.append('file', file);
      form.append('expectedRevision', revision);
      form.append('requestId', id);
      if (correctionEnabled) form.append('correction', JSON.stringify({ keyColumn, updatedAtColumn }));
      const response = await postForm(base, form, { signal: abort.signal, timeout: 360000 });
      if (token !== sequence.current || abort.signal.aborted) return;
      apply(unwrap(response, sourceId, id), true);
    } catch (failure: any) {
      if (token !== sequence.current || abort.signal.aborted) return;
      const status = failure?.response?.status;
      setError(message(failure));
      setUnknown(prepared && (!status || status >= 500));
      if (prepared && status && status < 500) {
        removeRecord();
        requestId.current = null;
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const transition = async (action: 'retry' | 'cancel') => {
    if (pending.current || disabled || !requestId.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const token = sequence.current,
      abort = new AbortController();
    controller.current = abort;
    try {
      const response = await post(`${base}/${requestId.current}/${action}`, {}, { signal: abort.signal });
      if (token !== sequence.current || abort.signal.aborted) return;
      apply(unwrap(response, sourceId, requestId.current ?? undefined), true);
    } catch (failure) {
      if (token === sequence.current && !abort.signal.aborted) {
        setError(message(failure));
        setUnknown(true);
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <section aria-label="복구 가능한 파일 갱신" className="min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="file"
          accept=".csv,.json,.parquet"
          aria-label="교체할 파일"
          className="hidden"
          disabled={disabled || locked}
          onChange={event => {
            setFile(event.target.files?.[0] ?? null);
            setError('');
          }}
        />
        <Button variant="outline" disabled={disabled || locked} onClick={() => input.current?.click()}>
          파일 선택
        </Button>
        <p className="min-w-0 flex-1 break-words text-sm" aria-live="polite">
          {file ? `선택한 파일: ${file.name}` : '선택한 파일 없음'}
        </p>
        <Button disabled={disabled || locked || !file || invalidCorrection} onClick={() => void submit()}>
          {correctionEnabled ? '검증 후 정정 반영' : '검증 후 파일 교체'}
        </Button>
      </div>
      {allowCorrection && keyColumns.length > 0 && timeColumns.length > 0 && (
        <details className="my-3 rounded-lg border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium">지연·정정 데이터 반영 설정</summary>
          <div className="mt-3 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                aria-label="업무 키와 수정 시점으로 정정"
                checked={correctionEnabled}
                disabled={disabled || locked}
                onCheckedChange={value => {
                  setCorrectionEnabled(value === true);
                  setError('');
                }}
              />
              <span>업무 키와 수정 시점으로 정정</span>
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              선택하지 않으면 전체 파일을 교체합니다. 정정은 기존 키의 최신 수정만 반영하고 새 키를 추가합니다. 키·수정
              시점이 비거나 같은 시점의 내용이 다르면 거절합니다. 입력은 기존 파일과 같은 모든 열·타입이어야 합니다.
            </p>
            {correctionEnabled && (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <TextField
                  label="업무 키"
                  select
                  value={keyColumn}
                  disabled={disabled || locked}
                  onChange={event => setKeyColumn(event.target.value)}
                >
                  <option value="">열을 선택하세요</option>
                  {keyColumns.map(column => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </TextField>
                <TextField
                  label="수정 시점"
                  select
                  value={updatedAtColumn}
                  disabled={disabled || locked}
                  onChange={event => setUpdatedAtColumn(event.target.value)}
                >
                  <option value="">열을 선택하세요</option>
                  {timeColumns.map(column => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </TextField>
              </div>
            )}
            {invalidCorrection && (
              <p className="text-xs text-muted-foreground">
                업무 키와 수정 시점 열을 선택한 뒤 정정을 실행하세요. 업무일과 수정 시점은 다를 수 있습니다.
              </p>
            )}
          </div>
        </details>
      )}
      <p className="my-2 text-xs text-muted-foreground">
        서버가 입력과 실행 상태를 보관합니다. 연결이 끊기면 파일을 다시 올리기 전에 같은 요청을 확인하세요. 페이지를 다시
        열어도 자동 재실행하지 않습니다.
      </p>
      <div aria-live="polite" role="status" className="my-2 text-sm">
        {checking
          ? '최근 갱신 작업 확인 중…'
          : busy
          ? '갱신 요청 확인 중…'
          : unknown
          ? '실행 결과를 확인하지 못했습니다. 같은 요청의 상태를 확인해 주세요.'
          : job
          ? `${job.originalname} · ${labels[job.status]} · ${job.attempts}회 실행`
          : ''}
      </div>
      {(job || (unknown && requestId.current)) && (
        <p className="mb-2 break-all text-xs text-muted-foreground">요청 {job?.requestId ?? requestId.current}</p>
      )}
      {error && (
        <Notice severity="error" className="my-2">
          {error}
        </Notice>
      )}
      {job?.error && (
        <Notice severity="error" className="my-2">
          {job.error.message}
        </Notice>
      )}
      {correctionEnabled && !allowCorrection && (
        <Notice severity="warning" className="my-2">
          이 서버가 정정 지원을 확인하지 못했습니다. 입력을 다시 전송하지 말고 서버 상태를 확인해 주세요.
        </Notice>
      )}
      {job?.correction && (
        <p className="my-2 break-words text-xs text-muted-foreground">
          정정 작업 · 업무 키 {job.correction.keyColumn} · 수정 시점 {job.correction.updatedAtColumn}
        </p>
      )}
      {job?.result?.correctionStats && (
        <section role="region" aria-label="정정 처리 결과" className="my-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{job.result.unchanged ? '변경 없이 확인 완료 · 현재 버전 유지' : '정정 반영 완료'}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {(
              [
                ['입력 행', 'inputRows'],
                ['현재 전체 행', 'rows'],
                ['신규', 'inserted'],
                ['수정', 'updated'],
                ['동일', 'identical'],
                ['오래된 수정 무시', 'ignoredOlder'],
                ['동일 입력 행 중복 제거', 'duplicateRowsDropped'],
                ['배치 내 이전 수정 제외', 'supersededRows'],
              ] as const
            ).map(([label, key]) => (
              <React.Fragment key={key}>
                <dt>{label}</dt>
                <dd className="text-right tabular-nums">{job.result.correctionStats[key].toLocaleString('ko-KR')}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            업무일은 각 행의 원래 날짜를 따릅니다. 수정 시점과 서버 업로드 시각은 별도입니다. 단순 재수신은 새 파일 버전을
            만들지 않습니다.
          </p>
        </section>
      )}
      {job?.error && <FileSchemaChange value={job.error} />}
      {job?.error?.code === 'FILE_SCHEMA_CHANGED' && <FileSchemaImpact sourceId={sourceId} requestId={job.requestId} />}
      {job?.storageAvailable === false && (
        <Notice severity="warning" className="my-2">
          입력을 보관한 서버에서 같은 작업을 다시 실행해 주세요. 마지막 성공 데이터는 유지됩니다.
        </Notice>
      )}
      {job?.cleanupPending && (
        <p className="my-2 text-xs text-muted-foreground">
          {job.status === 'cancelled'
            ? '취소는 확정되었습니다. 실행과 보관 입력 정리 중일 수 있습니다. 같은 갱신 요청 확인으로 정리 상태를 확인하세요.'
            : '갱신 결과는 확정되었습니다. 보관 입력 정리는 서버가 다시 시도합니다.'}{' '}
          정리가 끝날 때까지 보관 한도에 포함됩니다.
        </p>
      )}
      {job && ['failed', 'interrupted'].includes(job.status) && (
        <p className="my-2 text-xs text-muted-foreground">
          같은 입력으로 다시 실행하거나 활성화를 취소하세요. 다른 파일은 이 작업을 취소한 뒤 선택할 수 있습니다.
        </p>
      )}
      <div className="my-2 flex flex-wrap gap-2">
        {(job || unknown) && (
          <Button variant="outline" disabled={busy || checking || disabled} onClick={() => void read()}>
            같은 갱신 요청 확인
          </Button>
        )}
        {job && ['queued', 'interrupted', 'failed'].includes(job.status) && !unknown && (
          <Button
            disabled={
              busy ||
              disabled ||
              job.storageAvailable === false ||
              job.attempts >= 3 ||
              (!!job.correction && !allowCorrection)
            }
            onClick={() => void transition('retry')}
          >
            보관한 입력으로 다시 실행
          </Button>
        )}
        {job && !['succeeded', 'cancelled'].includes(job.status) && (
          <Button variant="ghost" disabled={busy || disabled} onClick={() => void transition('cancel')}>
            활성화 취소
          </Button>
        )}
        {missing && (
          <Button
            variant="outline"
            disabled={busy || disabled}
            onClick={() => {
              removeRecord();
              requestId.current = null;
              setUnknown(false);
              setMissing(false);
              setError('');
              setJob(null);
            }}
          >
            확인 후 새 요청 준비
          </Button>
        )}
      </div>
    </section>
  );
}
