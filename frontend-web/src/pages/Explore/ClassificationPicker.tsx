import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import {
  ClassificationPage,
  ClassificationRef,
  classificationError,
  classificationSession,
  listClassifications,
} from '@/api/classificationService';
import { useClassificationSession } from '../Enterprise/useClassificationSession';
type Props = {
  column: string;
  reference?: ClassificationRef | null;
  detachPending: boolean;
  onSelect: (name: string, ref: ClassificationRef) => void;
  onDetach: () => void;
};
export default function ClassificationPicker(props: Props) {
  const session = useClassificationSession();
  return <Picker key={`${props.column}:${session}`} {...props} session={session} />;
}
function Picker({ column, reference, detachPending, onSelect, onDetach, session }: Props & { session: string | null }) {
  const [page, setPage] = useState<ClassificationPage | null>(null),
    [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true),
    gate = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = async (more = false) => {
    if (gate.current) return;
    if (classificationSession() !== session) {
      setPage(null);
      setError('로그인 문맥이 변경됐습니다. 목록을 다시 읽으세요.');
      return;
    }
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await listClassifications(more ? page?.nextAfterId ?? undefined : undefined);
      if (!alive.current || classificationSession() !== session) return;
      if (more && page && (next.actorId !== page.actorId || next.organizationId !== page.organizationId)) {
        setPage(null);
        throw new Error('조직 문맥이 변경됐습니다. 분류 목록을 다시 읽으세요.');
      }
      setPage(more && page ? { ...next, entries: [...page.entries, ...next.entries] } : next);
    } catch (cause) {
      if (alive.current && classificationSession() === session) {
        setPage(null);
        setError(classificationError(cause));
      }
    } finally {
      if (alive.current) {
        gate.current = false;
        setBusy(false);
      }
    }
  };
  const choose = async (selectedId: number) => {
    if (gate.current || !page || !page.entries.some(e => e.id === selectedId && e.active)) return;
    if (classificationSession() !== session) {
      setPage(null);
      setError('로그인 문맥이 변경됐습니다. 목록을 다시 읽으세요.');
      return;
    }
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      const latest = await listClassifications(selectedId > 1 ? selectedId - 1 : undefined);
      if (!alive.current || classificationSession() !== session) return;
      if (latest.actorId !== page.actorId || latest.organizationId !== page.organizationId)
        throw new Error('계정 또는 조직 문맥이 변경됐습니다. 입력을 보존했습니다. 분류 목록을 다시 읽으세요.');
      const selected = latest.entries.find(e => e.id === selectedId && e.active);
      if (!selected) throw new Error('선택한 분류가 더 이상 활성 상태가 아닙니다. 입력을 보존했습니다.');
      setPage(p => p && { ...p, entries: p.entries.map(e => (e.id === selected.id ? selected : e)) });
      onSelect(selected.name, { organizationId: latest.organizationId, id: selected.id, version: selected.version });
    } catch (cause) {
      if (alive.current && classificationSession() === session) {
        setPage(null);
        setError(classificationError(cause));
      }
    } finally {
      if (alive.current) {
        gate.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <div role="group" aria-label={`${column} 공통 분류 연결`} className="mt-3 min-w-0 space-y-2 text-sm">
      {reference && (
        <p className="break-words">
          현재 연결 · 조직 {reference.organizationId} · 분류 {reference.id} · 버전 {reference.version}. 현재 사전을 자동
          조회하거나 이름을 갱신하지 않습니다. 변경은 미리보기 후 저장해야 반영됩니다.
        </p>
      )}
      {detachPending && <p>해제를 먼저 저장한 뒤 자유 분류명을 편집할 수 있습니다. 기존 이름은 유지합니다.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || detachPending} onClick={() => void load()}>
          {page ? '분류 목록 다시 읽기' : '공통 분류 불러오기'}
        </Button>
        {reference && (
          <Button type="button" variant="outline" disabled={busy} onClick={onDetach}>
            공통 분류 연결 해제
          </Button>
        )}
        {page?.nextAfterId && (
          <Button type="button" variant="outline" disabled={busy || detachPending} onClick={() => void load(true)}>
            분류 더 불러오기
          </Button>
        )}
      </div>
      {error && <Notice severity="error">{error}</Notice>}
      {page && (
        <>
          <p>현재 조직 {page.organizationId} · 불러온 활성 분류만 검색·선택합니다. 선택해야 이름·연결을 변경합니다.</p>
          <TextField label={`${column} 불러온 분류 검색`} value={search} onChange={e => setSearch(e.target.value)} />
          <TextField
            select
            label={`${column} 공통 분류`}
            value=""
            disabled={busy || detachPending}
            onChange={event => void choose(Number(event.target.value))}
          >
            <option value="">명시적으로 선택하세요</option>
            {page.entries
              .filter(e => e.active && e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
              .map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} · ID {e.id} · 버전 {e.version}
                </option>
              ))}
          </TextField>
        </>
      )}
    </div>
  );
}
