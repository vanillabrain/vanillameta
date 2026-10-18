import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { fetchReceivedDashboards, ReceivedDashboard } from '@/api/deliveryService';

export default function ReceivedDashboards() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="받은 자료" className="mt-4 min-w-0 rounded-lg border p-3 text-sm">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        받은 자료 {open ? '접기' : '열기'}
      </Button>
      {open && <ReceivedPanel />}
    </section>
  );
}
function ReceivedPanel() {
  const [entries, setEntries] = useState<ReceivedDashboard[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0),
    pending = useRef(false);
  const load = async (afterId?: number) => {
    if (pending.current) return;
    generation.current += 1;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    if (afterId === undefined) {
      setEntries([]);
      setNext(null);
    }
    try {
      const page = await fetchReceivedDashboards(afterId);
      if (generation.current !== current) return;
      setEntries(previous => (afterId === undefined ? page.entries : [...previous, ...page.entries]));
      setNext(page.nextAfterId);
    } catch {
      if (generation.current !== current) return;
      setEntries([]);
      setNext(null);
      setError('받은 자료를 확인하지 못했습니다. 다시 읽어 주세요.');
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
      pending.current = false;
    };
  }, []);
  return (
    <div className="mt-3 min-w-0 space-y-3" aria-busy={busy}>
      <p className="text-xs text-muted-foreground">현재 열람 가능한 조회 공유만 표시합니다. 열 때 권한을 다시 확인합니다.</p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
        받은 자료 다시 읽기
      </Button>
      {busy && <p role="status">받은 자료를 읽는 중…</p>}
      {error && <Notice severity="error">{error}</Notice>}
      {!busy && !error && entries.length === 0 && (
        <p role="status">
          {next === null
            ? '현재 열람할 수 있는 받은 자료가 없습니다.'
            : '이번 구간에는 열람 가능한 자료가 없습니다. 다음 구간을 확인할 수 있습니다.'}
        </p>
      )}
      <ul className="min-w-0 space-y-2">
        {entries.map(entry => (
          <li key={entry.dashboardId} className="min-w-0 rounded-md border p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words font-medium">{entry.title || `대시보드 #${entry.dashboardId}`}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  대시보드 #{entry.dashboardId} · 공유 버전 {entry.version}
                </p>
              </div>
              {entry.allowCopy === true && (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`/received/${entry.dashboardId}/remix`}
                    aria-label={`대시보드 ${entry.dashboardId} 내 소스로 복제`}
                  >
                    내 소스로 복제
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <a href={`/dashboard/${entry.dashboardId}`} aria-label={`대시보드 ${entry.dashboardId} 열기`}>
                  열기
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {next !== null && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void load(next)}>
          받은 자료 다음 구간
        </Button>
      )}
    </div>
  );
}
