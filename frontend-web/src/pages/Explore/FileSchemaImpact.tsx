import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import FileSchemaDiagnosis from './FileSchemaDiagnosis';

type Dependency = {
  id: string | number;
  title: string;
  columns: string[];
  affectedColumns: string[];
  status: 'affected' | 'review' | 'no-changed-column';
};
type Impact = {
  sourceId: number;
  requestId: string;
  sourceRevision?: string;
  dependencyRevision?: string;
  truncated: boolean;
  unreadable: number;
  metrics: Dependency[];
  dashboards: { id: number; title: string; status?: 'review'; blocks: Dependency[] }[];
};
const states = { affected: '변경 열의 영향 있음', review: '직접 확인 필요', 'no-changed-column': '변경 열 참조 없음' };
function validate(value: any, sourceId: number, requestId: string): Impact {
  const validText = (v: unknown) => typeof v === 'string' && v.length <= 300;
  const validColumns = (v: unknown) => Array.isArray(v) && v.length <= 128 && v.every(validText);
  const dependency = (v: any) =>
    v &&
    validText(v.title) &&
    validColumns(v.columns) &&
    validColumns(v.affectedColumns) &&
    Object.prototype.hasOwnProperty.call(states, v.status);
  if (
    value?.sourceId !== sourceId ||
    value.requestId !== requestId ||
    !Array.isArray(value.metrics) ||
    value.metrics.length > 100 ||
    !value.metrics.every(dependency) ||
    !Array.isArray(value.dashboards) ||
    value.dashboards.length > 100 ||
    !value.dashboards.every(
      (d: any) =>
        Number.isSafeInteger(d.id) &&
        d.id > 0 &&
        validText(d.title) &&
        Array.isArray(d.blocks) &&
        d.blocks.length <= 6 &&
        d.blocks.every(dependency),
    )
  )
    throw new Error('현재 갱신 요청의 영향 목록을 확인하지 못했습니다.');
  return value;
}
function DependencyRow({ item }: { item: Dependency }) {
  return (
    <li className="min-w-0 rounded-md border bg-background px-3 py-2 [overflow-wrap:anywhere]">
      <p className="text-sm font-medium">{item.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {states[item.status]}
        {item.affectedColumns.length > 0 ? ` · ${item.affectedColumns.join(', ')}` : ''}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.columns.length
          ? `참조 열: ${item.columns.join(', ')}`
          : item.status === 'review'
          ? '의존 열을 안전하게 판정하지 못했습니다.'
          : '특정 열에 의존하지 않는 집계입니다.'}
      </p>
    </li>
  );
}
export default function FileSchemaImpact({ sourceId, requestId }: { sourceId: number; requestId: string }) {
  const [data, setData] = useState<Impact | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0),
    request = useRef<AbortController | null>(null),
    pending = useRef(false);
  useEffect(() => {
    sequence.current += 1;
    setData(null);
    setError('');
    setBusy(false);
    pending.current = false;
    return () => {
      sequence.current += 1;
      request.current?.abort();
    };
  }, [sourceId, requestId]);
  const inspect = async () => {
    if (pending.current) return;
    const token = sequence.current,
      abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await get(`/bi/sources/${sourceId}/file-refreshes/${requestId}/impact`, undefined, {
        signal: abort.signal,
      });
      if (token !== sequence.current || abort.signal.aborted) return;
      if (response?.data?.status !== 'SUCCESS') throw new Error('영향 목록을 확인하지 못했습니다.');
      setData(validate(response.data.data, sourceId, requestId));
    } catch (failure: any) {
      if (token === sequence.current && !abort.signal.aborted) {
        setData(null);
        const message = failure?.response?.data?.message;
        setError(
          typeof message === 'string'
            ? message
            : '영향 목록을 불러오지 못했습니다. 기존 데이터는 유지됩니다. 다시 조회해 주세요.',
        );
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <section
      role="region"
      aria-label="열 변경 영향과 복구"
      className="my-3 min-w-0 rounded-lg border bg-muted/30 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-semibold">연결된 지표·블록 확인</h4>
        <Button variant="outline" disabled={busy} onClick={() => void inspect()}>
          {busy ? '영향 조회 중…' : data ? '영향 목록 새로고침' : '영향받는 지표·블록 확인'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        저장된 분석의 열 의존성만 확인합니다. 새 데이터의 값 변화, 미저장 초안, 일반 위젯·Pivot과 다른 사용자의 저장본은
        포함하지 않습니다.
      </p>
      {error && (
        <Notice severity="error" className="mt-3">
          {error}
        </Notice>
      )}
      {data && (
        <div className="mt-3 space-y-4">
          {data.sourceRevision && data.dependencyRevision && (
            <FileSchemaDiagnosis
              key={`${sourceId}:${requestId}:${data.sourceRevision}:${data.dependencyRevision}`}
              sourceId={sourceId}
              requestId={requestId}
              sourceRevision={data.sourceRevision}
              dependencyRevision={data.dependencyRevision}
            />
          )}
          {(data.truncated || data.unreadable > 0) && (
            <Notice severity="warning">
              일부 정의를 모두 확인하지 못했습니다. 표시되지 않은 항목을 영향 없음으로 판단하지 마세요.
            </Notice>
          )}
          <div>
            <h5 className="mb-2 text-sm font-medium">저장 지표 · {data.metrics.length}개</h5>
            <ul className="grid min-w-0 gap-2 md:grid-cols-2">
              {data.metrics.map(item => (
                <DependencyRow key={item.id} item={item} />
              ))}
            </ul>
            {!data.metrics.length && <p className="text-xs text-muted-foreground">이 소스의 활성 저장 지표가 없습니다.</p>}
          </div>
          <div className="space-y-3">
            <h5 className="text-sm font-medium">저장 대시보드 · {data.dashboards.length}개</h5>
            {data.dashboards.map(d => (
              <article key={d.id} className="min-w-0 space-y-2 rounded-lg border bg-background p-3">
                <h6 className="text-sm font-semibold [overflow-wrap:anywhere]">{d.title}</h6>
                {d.status === 'review' && <p className="text-xs">직접 확인 필요 · 저장 정의의 열을 판정하지 못했습니다.</p>}
                <ul className="space-y-2">
                  {d.blocks.map(item => (
                    <DependencyRow key={item.id} item={item} />
                  ))}
                </ul>
                <Link
                  className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline underline-offset-4"
                  to={`/dashboard/${d.id}/reuse?editor=studio`}
                >
                  새 데이터로 복사·열 연결
                </Link>
              </article>
            ))}
            {!data.dashboards.length && (
              <p className="text-xs text-muted-foreground">조회 범위에서 연결된 저장 분석이 없습니다.</p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            원본을 유지한 채 복구하려면 변경된 파일을 새 소스로 올린 뒤, 복사 화면에서 모든 열을 연결하고 전체 미리보기를
            확인하세요. 타입은 자동 변환하지 않으며 블록도 자동 제외하지 않습니다.
          </p>
          <Link
            className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline underline-offset-4"
            to="/data/file"
            target="_blank"
            rel="noopener noreferrer"
          >
            내 파일을 새 소스로 연결 ↗
          </Link>
        </div>
      )}
    </section>
  );
}
