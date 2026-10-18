import {
  readClassificationCreate,
  storeClassificationCreate,
  clearClassificationCreate,
} from '@/api/classificationCreateStorage';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import {
  Classification,
  ClassificationCreate,
  ClassificationPage,
  classificationError,
  classificationName,
  classificationSession,
  createClassification,
  listClassifications,
  updateClassification,
} from '@/api/classificationService';
import { useClassificationSession } from './useClassificationSession';
type Props = { actorId: number; organizationId: number };
export default function Classifications(props: Props) {
  const session = useClassificationSession();
  return <Registry key={`${props.actorId}:${props.organizationId}:${session}`} {...props} session={session} />;
}
function Registry({ actorId, organizationId, session }: Props & { session: string | null }) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState<ClassificationPage | null>(null);
  const [query, setQuery] = useState(''),
    [name, setName] = useState('');
  const [edit, setEdit] = useState<{ entry: Classification; name: string; active: boolean } | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [storageReadFailed, setStorageReadFailed] = useState(false);
  const clearStored = () => {
    const cleared = clearClassificationCreate(session, actorId, organizationId);
    setStorageWarning(
      cleared ? '' : '탭 복구 기록을 지우지 못했습니다. 새로고침하면 같은 UUID 요청이 다시 나타날 수 있습니다.',
    );
    return cleared;
  };
  const [pending, setPending] = useState<ClassificationCreate | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const gate = useRef(false),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const current = (token: number) => token === generation.current && classificationSession() === session;
  const run = async (action: (token: number) => Promise<void>) => {
    if (gate.current) return;
    if (classificationSession() !== session) {
      setPage(null);
      clearClassificationCreate(session, actorId, organizationId);
      setStorageWarning('');
      setPending(null);
      setName('');
      setEdit(null);
      setError('로그인 문맥이 변경됐습니다. 조직 화면을 다시 읽으세요.');
      return;
    }
    const token = generation.current;
    gate.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action(token);
    } catch (cause) {
      if (current(token)) setError(classificationError(cause));
    } finally {
      if (current(token)) {
        gate.current = false;
        setBusy(false);
      }
    }
  };
  const load = (more = false) =>
    void run(async token => {
      const next = await listClassifications(more ? page?.nextAfterId ?? undefined : undefined);
      if (!current(token)) return;
      if (next.actorId !== actorId || next.organizationId !== organizationId) {
        setPage(null);
        setPending(null);
        setName('');
        setEdit(null);
        throw new Error('현재 조직 문맥이 다릅니다. 조직 화면을 다시 읽으세요.');
      }
      setPage(more && page ? { ...next, entries: [...page.entries, ...next.entries] } : next);
      if (!pending && next.canManage) {
        const restored = readClassificationCreate(session, next.actorId, next.organizationId);
        setStorageReadFailed(restored.error);
        if (restored.error)
          setStorageWarning(
            '탭 복구 기록을 읽지 못했습니다. 현재 요청은 보존합니다. 분류 목록을 다시 읽어 복구 기록을 확인하세요.',
          );
        else setStorageWarning('');
        if (restored.record) {
          setPending(restored.record);
          setName(restored.record.name);
          setNotice(
            '새로고침 전의 미확정 생성 요청을 찾았습니다. 자동 접수하지 않았습니다. 같은 요청을 명시적으로 확인하세요.',
          );
        }
      }
    });
  const create = () =>
    void run(async token => {
      if (!page?.canManage || storageReadFailed) return;
      const body = pending ?? {
        expectedActorId: page.actorId,
        expectedOrganizationId: page.organizationId,
        requestId: crypto.randomUUID(),
        name: classificationName(name),
      };
      if (!pending && !storeClassificationCreate(session, body))
        setStorageWarning(
          '탭 복구 기록을 저장하지 못했습니다. 현재 화면에는 같은 요청을 보존하지만 새로고침 후 복구할 수 없습니다.',
        );
      setPending(body);
      try {
        const result = await createClassification(body);
        if (!current(token)) return;
        clearStored();
        setPending(null);
        setName('');
        if (result.replayed) {
          setNotice(
            `이전에 접수한 분류 생성 #${result.entry.id}을 확인했습니다. 과거 생성 영수증입니다. 현재 이름과 활성 상태는 분류 목록을 다시 읽어 확인하세요.`,
          );
        } else {
          setNotice(
            `공통 분류를 만들었습니다. #${result.entry.id}${
              page.nextAfterId !== null ? ' · 다음 페이지를 더 불러오거나 분류 목록을 다시 읽어 현재 상태를 확인하세요.' : ''
            }`,
          );
          // Only a fresh creation on a complete list can extend the loaded range.
          setPage(p =>
            p && p.nextAfterId === null && !p.entries.some(e => e.id === result.entry.id)
              ? { ...p, entries: [...p.entries, result.entry].sort((a, b) => a.id - b.id) }
              : p,
          );
        }
      } catch (cause) {
        if (current(token) && [400, 409].includes((cause as any)?.response?.status)) {
          clearStored();
          setPending(null);
        }
        throw cause;
      }
    });
  const save = () =>
    void run(async token => {
      if (!page?.canManage || !edit || pending) return;
      const result = await updateClassification(edit.entry.id, {
        expectedActorId: page.actorId,
        expectedOrganizationId: page.organizationId,
        expectedVersion: edit.entry.version,
        name: classificationName(edit.name),
        active: edit.active,
      });
      if (!current(token)) return;
      setPage(p => p && { ...p, entries: p.entries.map(e => (e.id === result.entry.id ? result.entry : e)) });
      setEdit(null);
      setNotice('분류 변경을 저장했습니다. 기존 소스의 이름과 연결은 자동 갱신하지 않습니다.');
    });
  return (
    <section aria-label="조직 공통 분류" className="mt-4 min-w-0 rounded-lg border p-3 text-sm">
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setOpen(v => !v);
          if (!open && !page) load();
        }}
      >
        공통 분류
      </Button>
      {open && (
        <div className="mt-3 min-w-0 space-y-3">
          <p>
            분류는 정리용 업무 정보입니다. 기존 소스·조건·게시를 자동 변경하지 않습니다. 검색은 불러온 목록에만 적용됩니다.
          </p>
          {storageWarning && <Notice severity="warning">{storageWarning}</Notice>}
          {error && <Notice severity="error">{error}</Notice>}
          {notice && <p role="status">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !!pending} onClick={() => load()}>
              분류 목록 다시 읽기
            </Button>
            {page?.nextAfterId && (
              <Button variant="outline" disabled={busy || !!pending} onClick={() => load(true)}>
                분류 더 불러오기
              </Button>
            )}
          </div>
          <TextField label="불러온 분류 검색" value={query} onChange={e => setQuery(e.target.value)} />
          {page && (
            <>
              <p>
                현재 조직 {page.organizationId} · {page.canManage ? '관리 가능' : '조회 전용'}
              </p>
              {page.canManage && (
                <div className="flex min-w-0 flex-wrap items-end gap-2">
                  <TextField
                    className="min-w-0 flex-1"
                    label="새 공통 분류 이름"
                    maxLength={80}
                    value={name}
                    disabled={busy || !!pending}
                    onChange={e => setName(e.target.value)}
                  />
                  <Button disabled={busy || storageReadFailed || (!pending && !name.trim())} onClick={create}>
                    {pending ? '같은 생성 요청 확인' : '분류 만들기'}
                  </Button>
                </div>
              )}
              {pending && (
                <div className="space-y-2">
                  <p role="status">
                    결과가 미확정입니다. 이름·조직·UUID를 고정해 같은 요청만 재확인합니다. 기록을 버려도 이미 생성된 서버
                    분류는 삭제되지 않습니다.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (clearStored()) setPending(null);
                    }}
                  >
                    미확정 생성 요청 버리기
                  </Button>
                </div>
              )}
              <ul className="min-w-0 space-y-2">
                {page.entries
                  .filter(e => e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                  .map(e => (
                    <li key={e.id} aria-label={`공통 분류 ${e.id}`} className="min-w-0 space-y-2 rounded-md border p-3">
                      <p className="break-words [overflow-wrap:anywhere]">
                        {e.name} · ID {e.id} · 버전 {e.version} · {e.active ? '활성' : '비활성'}
                      </p>
                      {page.canManage && (
                        <Button
                          variant="outline"
                          disabled={busy || !!pending}
                          onClick={() => setEdit({ entry: e, name: e.name, active: e.active })}
                        >
                          분류 편집
                        </Button>
                      )}
                      {edit?.entry.id === e.id && (
                        <div className="min-w-0 space-y-2">
                          <TextField
                            label="분류 이름"
                            maxLength={80}
                            value={edit.name}
                            disabled={busy}
                            onChange={event => setEdit({ ...edit, name: event.target.value })}
                          />
                          <label className="flex min-h-9 items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label="분류 활성"
                              checked={edit.active}
                              disabled={busy}
                              onChange={event => setEdit({ ...edit, active: event.target.checked })}
                            />
                            분류 활성
                          </label>
                          <Button disabled={busy || !edit.name.trim()} onClick={save}>
                            분류 변경 저장
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
