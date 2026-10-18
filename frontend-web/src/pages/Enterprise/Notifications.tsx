import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { fetchNotifications, markNotification, PersonalNotification } from '@/api/enterpriseService';

/** Personal display state only. Opening a resource still requires its current server permissions. */
export default function Notifications({ organizationId }: { organizationId: number }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PersonalNotification[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setOpen(false);
    setEntries([]);
    setNext(null);
    setBusy(false);
    setError('');
  }, [organizationId]);

  const load = async (before?: number) => {
    if (pending.current) return;
    generation.current += 1;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    if (before === undefined) {
      setEntries([]);
      setNext(null);
    }
    try {
      const page = await fetchNotifications(before);
      if (generation.current !== current) return;
      setEntries(previous => (before === undefined ? page.entries : [...previous, ...page.entries]));
      setNext(page.nextBeforeId);
    } catch {
      if (generation.current !== current) return;
      setEntries([]);
      setNext(null);
      setError('알림을 확인하지 못했습니다. 다시 읽어 주세요.');
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const mark = async (id: number, action: 'read' | 'remove') => {
    if (pending.current) return;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await markNotification(id, action);
      if (generation.current !== current) return;
      setEntries(previous =>
        result.removed
          ? previous.filter(entry => entry.id !== id)
          : previous.map(entry => (entry.id === id ? { ...entry, read: result.read } : entry)),
      );
    } catch {
      if (generation.current === current)
        setError('알림 상태를 저장하지 못했습니다. 같은 동작으로 다시 시도할 수 있습니다.');
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const toggle = () => {
    if (open) {
      generation.current += 1;
      pending.current = false;
      setBusy(false);
      setEntries([]);
      setNext(null);
      setError('');
      setOpen(false);
    } else {
      setOpen(true);
      void load();
    }
  };
  return (
    <section aria-label="내 알림" className="mt-4 min-w-0 rounded-lg border p-3 text-sm">
      <Button variant="outline" size="sm" aria-expanded={open} onClick={toggle}>
        내 알림 {open ? '접기' : '열기'}
      </Button>
      {open && (
        <div className="mt-3 min-w-0 space-y-3" aria-busy={busy}>
          <p className="text-xs text-muted-foreground">
            권한 변경과 공유·회수 기록입니다. 현재 접근 권한은 자료를 열 때 다시 확인합니다. 목록 제거는 자료나 권한을
            삭제하지 않습니다.
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            알림 다시 읽기
          </Button>
          {error && <Notice severity="error">{error}</Notice>}
          {busy && <p role="status">알림 처리 중…</p>}
          {!busy && !error && entries.length === 0 && <p role="status">표시할 알림이 없습니다.</p>}
          <ul className="min-w-0 space-y-2">
            {entries.map(entry => (
              <li key={entry.id} className="min-w-0 rounded-md border p-3">
                <p className="break-words">
                  {entry.resourceKind === 'source' ? '소스' : '대시보드'} #{entry.resourceId}{' '}
                  {entry.viaGroup === true ? '그룹 ' : ''}
                  {entry.eventType === 'shared' ? '조회 공유' : entry.eventType === 'unshared' ? '공유 회수' : '권한 변경'} ·
                  버전 {entry.version}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time> ·{' '}
                  {entry.read ? '읽음' : '읽지 않음'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || entry.read}
                    aria-label={`알림 ${entry.id} 읽음`}
                    onClick={() => void mark(entry.id, 'read')}
                  >
                    읽음
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`알림 ${entry.id} 목록 제거`}
                    onClick={() => void mark(entry.id, 'remove')}
                  >
                    목록 제거
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {next !== null && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void load(next)}>
              이전 알림 더 보기
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
