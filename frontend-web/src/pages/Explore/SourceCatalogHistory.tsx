import React, { useEffect, useId, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';

type Entry = { version: number; label: string | null; createdAt: string; unreadable: boolean };
type Page = { sourceId: number; entries: Entry[]; nextBeforeVersion: number | null };
type Change = { column: string | null; field: string; before: string | null; after: string | null };
type Comparison = {
  sourceId: number;
  fromVersion: number;
  toVersion: number;
  schemaChanged: boolean;
  dataChanged: boolean;
  changes: Change[];
};
const unwrap = <T,>(response: any): T => {
  if (response?.data?.status !== 'SUCCESS' || !response.data.data) throw new Error('invalid response');
  return response.data.data;
};
const text = (value: string | null) => (value === null ? '항목 없음' : value === '' ? '빈 값' : value);
const fieldLabel: Record<string, string> = { label: '표시명', description: '업무 설명', unit: '단위' };
const savedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '시각 확인 불가' : date.toLocaleString('ko-KR');
};
export default function SourceCatalogHistory({ sourceId, savedVersion }: { sourceId: number; savedVersion: number }) {
  return <History key={`${sourceId}:${savedVersion}`} sourceId={sourceId} />;
}
function History({ sourceId }: { sourceId: number }) {
  const id = useId();
  const live = useRef(true);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const read = async (older = false) => {
    if (busy) return;
    setBusy(true);
    setError('');
    if (!older) setComparison(null);
    try {
      const next = unwrap<Page>(
        await post('/bi/source-catalog/history', {
          sourceId,
          ...(older && page?.nextBeforeVersion ? { beforeVersion: page.nextBeforeVersion } : {}),
        }),
      );
      if (!live.current) return;
      setPage(older ? { ...next, entries: [...(page?.entries ?? []), ...next.entries] } : next);
      if (!older) {
        const valid = next.entries.filter(entry => !entry.unreadable);
        setFrom(String(valid[1]?.version ?? ''));
        setTo(String(valid[0]?.version ?? ''));
      }
    } catch {
      if (live.current) setError('저장 이력을 불러오지 못했습니다. 입력은 유지됩니다.');
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const compare = async () => {
    if (busy || !from || !to || Number(from) >= Number(to)) return;
    setBusy(true);
    setError('');
    setComparison(null);
    try {
      const next = unwrap<Comparison>(
        await post('/bi/source-catalog/compare', { sourceId, fromVersion: Number(from), toVersion: Number(to) }),
      );
      if (live.current) setComparison(next);
    } catch (failure) {
      if (live.current)
        setError(
          failure?.response?.status === 409
            ? '선택한 이력을 읽을 수 없습니다. 다른 버전을 선택하거나 담당자에게 확인해 주세요.'
            : failure?.response?.status === 404
            ? '선택한 저장 버전이 없습니다. 이력을 다시 읽어 주세요.'
            : '버전 비교에 실패했습니다. 다시 시도해 주세요.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const changeVersion = (set: (value: string) => void, value: string) => {
    set(value);
    setComparison(null);
    setError('');
  };
  const healthy = page?.entries.filter(entry => !entry.unreadable) ?? [];
  return (
    <section className="min-w-0 border-t border-border pt-3" aria-label="업무 설명 저장 이력">
      <Button
        size="sm"
        variant="ghost"
        type="button"
        disabled={busy}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          if (!open && !page) void read();
        }}
      >
        저장 이력·버전 비교
      </Button>
      {open && (
        <div id={id} className="mt-3 min-w-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            저장된 두 버전만 비교합니다. 현재 입력과 원본 데이터는 바뀌지 않습니다. 저장 시각은 현재 기기의 시간대입니다.
          </p>
          {busy && (
            <p role="status" className="text-sm">
              이력을 확인하고 있습니다…
            </p>
          )}
          {error && <Notice severity="error">{error}</Notice>}
          {page && page.entries.length === 0 && <p className="text-sm">아직 저장한 업무 설명이 없습니다.</p>}
          {page && page.entries.length > 0 && (
            <ol className="min-w-0 space-y-2" aria-label="저장 버전 목록">
              {page.entries.map(entry => (
                <li key={entry.version} className="rounded-md border border-border p-3 text-sm [overflow-wrap:anywhere]">
                  <span className="font-medium">버전 {entry.version}</span> ·{' '}
                  {entry.unreadable ? '읽을 수 없는 이력' : entry.label}
                  <span className="mt-1 block text-xs text-muted-foreground">{savedAt(entry.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => void read()}>
              이력 다시 읽기
            </Button>
            {page?.nextBeforeVersion && (
              <Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => void read(true)}>
                이전 이력 더 보기
              </Button>
            )}
          </div>
          {page && healthy.length < 2 && page.entries.length > 0 && (
            <p className="text-sm">
              {page.nextBeforeVersion
                ? '정상 버전이 부족합니다. 이전 이력을 더 읽어 비교할 버전을 찾아보세요.'
                : '비교하려면 정상 저장 버전이 두 개 이상 필요합니다.'}
            </p>
          )}
          {healthy.length >= 2 && (
            <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <TextField
                select
                label="이전 설명 버전"
                value={from}
                disabled={busy}
                onChange={event => changeVersion(setFrom, event.target.value)}
              >
                <option value="">선택하세요</option>
                {healthy.map(entry => (
                  <option key={entry.version} value={entry.version}>
                    버전 {entry.version}
                  </option>
                ))}
              </TextField>
              <TextField
                select
                label="이후 설명 버전"
                value={to}
                disabled={busy}
                onChange={event => changeVersion(setTo, event.target.value)}
              >
                <option value="">선택하세요</option>
                {healthy.map(entry => (
                  <option key={entry.version} value={entry.version}>
                    버전 {entry.version}
                  </option>
                ))}
              </TextField>
              <Button
                size="sm"
                type="button"
                className="justify-self-start"
                disabled={busy || !from || !to || Number(from) >= Number(to)}
                onClick={() => void compare()}
              >
                선택한 버전 비교
              </Button>
              {from && to && Number(from) >= Number(to) && (
                <p className="text-sm sm:col-span-full">이전 버전보다 큰 이후 버전을 선택해 주세요.</p>
              )}
            </div>
          )}
          {comparison && (
            <div className="min-w-0 space-y-3" aria-label="업무 설명 비교 결과">
              <p role="status" className="text-sm font-medium">
                버전 {comparison.fromVersion} → 버전 {comparison.toVersion} · 변경 {comparison.changes.length}개
              </p>
              {comparison.schemaChanged && (
                <Notice severity="warning">
                  두 저장 버전의 원본 열 구조가 다릅니다. 이 비교는 업무 설명만 보여 주며 구조를 복원하지 않습니다.
                </Notice>
              )}
              {comparison.dataChanged && (
                <p className="text-xs text-muted-foreground">저장 당시 기준 데이터 버전도 다릅니다.</p>
              )}
              {comparison.changes.length === 0 && <p className="text-sm">두 버전의 업무 설명은 같습니다.</p>}
              {comparison.changes.map(change => (
                <div
                  key={JSON.stringify([change.column, change.field])}
                  className="min-w-0 rounded-md border border-border p-3"
                >
                  <h3 className="mb-2 text-sm font-medium [overflow-wrap:anywhere]">
                    {change.column === null ? '소스' : change.column} · {fieldLabel[change.field] ?? change.field}
                  </h3>
                  <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">이전 · 버전 {comparison.fromVersion}</dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{text(change.before)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">이후 · 버전 {comparison.toVersion}</dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{text(change.after)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
