import React, { useEffect, useId, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
type Kind = 'metrics' | 'analyses';
type Entry = { id: number; title: string };
type Page = { sourceId: number; kind: Kind; entries: Entry[]; nextAfterId: number | null };
export default function SourceCatalogUsage({ sourceId }: { sourceId: number }) {
  return <Usage key={sourceId} sourceId={sourceId} />;
}
function Usage({ sourceId }: { sourceId: number }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('metrics');
  return (
    <section className="min-w-0 border-t border-border pt-3" aria-label="소스 사용처">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        이 소스의 사용처 확인
      </Button>
      {open && (
        <div id={id} className="mt-3 min-w-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            활성 지표와 현재 열 수 있는 내 저장 분석의 직접 소스 연결을 확인합니다. 일반 위젯·게시본·독립 사본의 간접 영향은
            포함하지 않으며 분석을 자동 수정하지 않습니다.
          </p>
          <TextField
            select
            label="사용처 유형"
            value={kind}
            onChange={event => setKind(event.target.value as Kind)}
            className="w-full sm:max-w-64"
          >
            <option value="metrics">활성 지표</option>
            <option value="analyses">저장 분석</option>
          </TextField>
          <UsagePage key={kind} sourceId={sourceId} kind={kind} />
        </div>
      )}
    </section>
  );
}
function UsagePage({ sourceId, kind }: { sourceId: number; kind: Kind }) {
  const [cursor, setCursor] = useState<number | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    post('/bi/source-catalog/usage', { sourceId, kind, ...(cursor === undefined ? {} : { afterId: cursor }) })
      .then(response => {
        const page = response?.data?.data as Page;
        if (
          response?.data?.status !== 'SUCCESS' ||
          page?.sourceId !== sourceId ||
          page?.kind !== kind ||
          !Array.isArray(page.entries)
        )
          throw new Error('invalid usage');
        if (page.nextAfterId !== null && (!Number.isSafeInteger(page.nextAfterId) || page.nextAfterId <= (cursor ?? 0)))
          throw new Error('invalid continuation');
        if (!active) return;
        setEntries(current => (cursor === undefined ? page.entries : [...current, ...page.entries]));
        setNext(page.nextAfterId);
        setLoaded(true);
      })
      .catch(failure => {
        if (active && [401, 403].includes(failure?.response?.status)) {
          setEntries([]);
          setNext(null);
          setLoaded(false);
        }
        if (active) setError('사용처를 확인하지 못했습니다. 현재 편집 내용은 유지됩니다.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [sourceId, kind, cursor, attempt]);
  return (
    <div className="min-w-0 space-y-3">
      {busy && (
        <p role="status" className="text-sm">
          사용처를 확인하고 있습니다…
        </p>
      )}
      {error && <Notice severity="error">{error}</Notice>}
      {loaded && (
        <p role="status" className="text-xs text-muted-foreground">
          확인된 직접 연결 {entries.length}개 · 조회 시점 기준
        </p>
      )}
      {!busy && loaded && entries.length === 0 && <p className="text-sm">현재까지 확인된 사용처가 없습니다.</p>}
      {entries.length > 0 && (
        <ul className="min-w-0 space-y-2" aria-label="확인한 소스 사용처 목록">
          {entries.map(entry => (
            <li
              key={entry.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{entry.title}</span>
              {kind === 'analyses' && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <a
                    href={`/dashboard/${entry.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${entry.title} 열기`}
                  >
                    분석 열기
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!busy && next !== null && (
        <p className="text-xs text-muted-foreground">아직 확인할 목록이 남아 있습니다. 계속 확인해 주세요.</p>
      )}
      <div className="flex min-w-0 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setCursor(undefined);
            setAttempt(value => value + 1);
          }}
        >
          처음부터 다시 조회
        </Button>
        {error && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>
            사용처 조회 다시 시도
          </Button>
        )}
        {next !== null && (
          <Button type="button" size="sm" variant="outline" disabled={busy || !!error} onClick={() => setCursor(next)}>
            사용처 더 확인
          </Button>
        )}
      </div>
    </div>
  );
}
