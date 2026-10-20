import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { Column } from './SourceConditions';
import { ConditionProfile, readConditionProfile } from './conditionProfile';
export default function ConditionProfilePanel({
  contextKey,
  columns,
  disabled = false,
  load,
  scopeLabel,
}: {
  contextKey: string;
  columns: Column[];
  disabled?: boolean;
  scopeLabel: string;
  load: (selected: string[], signal: AbortSignal) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [result, setResult] = useState<{ key: string; selection: string; data: ConditionProfile } | null>(null);
  const serial = useRef(0),
    controller = useRef<AbortController | null>(null),
    live = useRef({ contextKey, selected, disabled });
  live.current = { contextKey, selected, disabled };
  useEffect(() => {
    serial.current += 1;
    controller.current?.abort();
    setBusy(false);
    setError('');
    setResult(null);
  }, [contextKey, disabled]);
  useEffect(
    () => () => {
      serial.current += 1;
      controller.current?.abort();
    },
    [],
  );
  const visible =
    result?.key === contextKey && result.selection === JSON.stringify(selected) && !disabled ? result.data : null;
  const request = async () => {
    if (disabled || busy || !selected.length) return;
    serial.current += 1;
    const key = contextKey,
      selection = [...selected],
      token = serial.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const raw = await load(selection, abort.signal);
      if (
        token !== serial.current ||
        abort.signal.aborted ||
        live.current.disabled ||
        live.current.contextKey !== key ||
        JSON.stringify(live.current.selected) !== JSON.stringify(selection)
      )
        return;
      const data = readConditionProfile(raw, selection, columns);
      setResult({ key, selection: JSON.stringify(selection), data });
    } catch (cause) {
      if (token === serial.current && !abort.signal.aborted)
        setError(
          cause?.response?.status === 409
            ? '조회 기준이 변경됐습니다. 입력은 유지했습니다. 최신 상태를 확인하고 다시 조회하세요.'
            : '분포·표본을 조회하지 못했습니다. 선택한 열과 입력은 유지했습니다. 연결과 데이터 상태를 확인한 뒤 다시 조회하세요.',
        );
    } finally {
      if (token === serial.current) setBusy(false);
    }
  };
  const percent = (ratio: number | null) => (ratio === null ? '비율 없음' : `${Math.round(ratio * 10000) / 100}%`);
  const scalar = (v: string | null, truncated = false) =>
    v === null ? '값 없음 (NULL)' : v + (truncated ? '… (잘림)' : '');
  return (
    <section aria-label="분포·표본 탐색" className="my-3 min-w-0 rounded-lg border border-border">
      <Button
        type="button"
        variant="ghost"
        className="m-2 max-w-[calc(100%-1rem)]"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        분포·표본 탐색
      </Button>
      {open && (
        <div className="min-w-0 space-y-3 border-t border-border p-3 text-sm">
          <p className="break-words">{scopeLabel}</p>
          <p>
            전체 값 빈도 상위 20개와 나머지를 비교합니다. 선택 열의 정렬 표본은 최대 20행이며 무작위·대표표본이 아닙니다.
          </p>
          {!columns.length && <Notice severity="info">현재 열 목록을 먼저 확인하세요. 열 이름은 원본 기준입니다.</Notice>}
          <fieldset disabled={disabled || busy} className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
            <legend className="text-sm font-medium">조회할 열 · 최대 6개</legend>
            {columns.map(column => (
              <label key={column.name} className="flex min-h-9 min-w-0 items-center gap-2 break-words">
                <input
                  type="checkbox"
                  aria-label={`${column.name} 분포·표본 선택`}
                  checked={selected.includes(column.name)}
                  disabled={column.kind === 'unsupported' || (!selected.includes(column.name) && selected.length >= 6)}
                  onChange={e => {
                    serial.current += 1;
                    controller.current?.abort();
                    setBusy(false);
                    setError('');
                    setResult(null);
                    setSelected(old => (e.target.checked ? [...old, column.name] : old.filter(v => v !== column.name)));
                  }}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {column.name}{' '}
                  <span className="text-xs text-muted-foreground">
                    {column.type}
                    {column.kind === 'unsupported' ? ' · 미지원' : ''}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !selected.length}
            aria-disabled={disabled || busy || !selected.length}
            aria-busy={busy}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => void request()}
          >
            분포·표본 조회
          </Button>
          {busy && <p role="status">전체 분포와 제한 표본 조회 중…</p>}
          {error && (
            <Notice severity="error" role="alert">
              {error}
            </Notice>
          )}
          {visible && (
            <div className="min-w-0 space-y-3">
              <p role="status">
                현재 범위 전체 {visible.population.total}행 · 포함 충족 {visible.population.matched}행 · 그중 제외{' '}
                {visible.population.excluded}행 · 최종 {visible.population.remaining}행
              </p>
              <p>
                현재 범위 전체 대비 · 포함 {percent(visible.population.matchedRatio)} · 최종{' '}
                {percent(visible.population.remainingRatio)}
              </p>
              {visible.distributions.map(d => (
                <article
                  key={d.column}
                  aria-label={`${d.column} 전체 분포`}
                  className="min-w-0 rounded-md border border-border p-2"
                >
                  <h3 className="break-words font-medium">{d.column} · 전체 값 빈도</h3>
                  <p className="text-xs text-muted-foreground">
                    {d.totalGroups === '0' ? (
                      '현재 범위에 값 그룹이 없습니다.'
                    ) : (
                      <>
                        NULL 포함 {d.totalGroups}그룹 · 범위 {scalar(d.range.minimum, d.range.minimumTruncated)} ~{' '}
                        {scalar(d.range.maximum, d.range.maximumTruncated)}
                      </>
                    )}
                  </p>
                  <div
                    className="min-w-0 overflow-x-auto"
                    tabIndex={0}
                    role="region"
                    aria-label={`${d.column} 분포 표 가로 스크롤`}
                  >
                    <table className="w-full min-w-96 text-left text-sm">
                      <thead>
                        <tr>
                          {['값', '전체', '포함', '제외', '최종'].map((s, index) => (
                            <th key={s} className={'px-2 py-1 whitespace-nowrap font-medium' + (index ? ' text-right' : '')}>
                              {s}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="min-w-32 max-w-64 px-2 py-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                              {scalar(row.value, row.valueTruncated)}
                            </td>
                            {[row.total, row.matched, row.excluded, row.remaining].map((v, k) => (
                              <td key={k} className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {d.hasMore && (
                          <tr>
                            <th className="px-2 py-1 whitespace-nowrap">나머지 그룹</th>
                            {[d.other.total, d.other.matched, d.other.excluded, d.other.remaining].map((v, k) => (
                              <td key={k} className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
                                {v}
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
              <h3 className="font-medium">
                정렬 표본 · {visible.sample.rows.length}/{visible.sample.totalRows}행
                {visible.sample.hasMore ? ' · 추가 행 있음' : ''}
              </h3>
              <p className="text-xs text-muted-foreground">
                선택 열 순서로 NULL 우선 정렬합니다. 중복 행은 유지하며 셀은 200문자 뒤를 줄입니다. 전체 분포는 이 표본의
                추정치가 아닙니다. 표가 넓으면 표 안에서 가로로 이동하세요.
              </p>
              <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label="선택 열 표본 표 가로 스크롤">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {visible.sample.columns.map(c => (
                        <th key={c.name} className="px-2 py-1 [overflow-wrap:anywhere]">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.sample.rows.length === 0 && (
                      <tr>
                        <td colSpan={visible.sample.columns.length} className="px-2 py-3 text-muted-foreground">
                          {visible.population.total === '0'
                            ? '현재 범위에 데이터가 없습니다. 원본 데이터·기간·필터를 확인하세요.'
                            : '조건을 만족하는 행이 없습니다. 포함·제외 조건을 확인하세요.'}
                        </td>
                      </tr>
                    )}
                    {visible.sample.rows.map((row, i) => (
                      <tr key={i}>
                        {row.values.map((v, k) => (
                          <td key={k} className="max-w-64 px-2 py-1 align-top whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {scalar(v, row.truncated[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
