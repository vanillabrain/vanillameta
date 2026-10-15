import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { get, post, postForm } from '@/helpers/apiHelper';

type Version = { id: string; originalname: string; rows: number; uploadedAt: string; current: boolean };
type Versions = {
  sourceId: number;
  revision: string;
  currentVersionId: string;
  limit: 5;
  versions: Version[];
  unchanged?: boolean;
};
type Props = { sourceId: number; onChanged: () => void; disabled?: boolean };

function timestamp(uploadedAt: string) {
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '—' };
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    day: `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function serverError(error: unknown, fallback: string): string {
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  const envelope = body as { data?: unknown; message?: unknown } | undefined;
  const nested = envelope?.data as { message?: unknown } | undefined;
  const message = [body, envelope?.data, nested?.message, envelope?.message].find(
    candidate => typeof candidate === 'string' && candidate.trim(),
  );
  return typeof message === 'string' ? message : fallback;
}

function unwrap(response: { data: { status: string; data: Versions } }, sourceId: number): Versions {
  const data = response.data.data;
  if (response.data.status !== 'SUCCESS') throw Object.assign(new Error('파일 버전 요청 실패'), { response });
  if (data?.sourceId !== sourceId || typeof data.revision !== 'string' || !Array.isArray(data.versions)) {
    throw new Error('파일 버전 응답을 확인할 수 없습니다.');
  }
  return data;
}

export default function FileVersions({ sourceId, onChanged, disabled = false }: Props) {
  const [versions, setVersions] = useState<Versions | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    pending.current = true;
    setVersions(null);
    setFile(null);
    if (input.current) input.current.value = '';
    setConfirmId(null);
    setError('');
    setNotice('');
    setBusy('파일 버전 불러오는 중…');
    void (async () => {
      try {
        const fresh = unwrap(
          await get(`/database/${sourceId}/file-versions`, undefined, { signal: abort.signal }),
          sourceId,
        );
        if (token === generation.current && !abort.signal.aborted) setVersions(fresh);
      } catch (e: unknown) {
        if (token === generation.current && !abort.signal.aborted)
          setError(serverError(e, '파일 버전을 불러오지 못했습니다. 다시 시도해 주세요.'));
      } finally {
        if (token === generation.current && !abort.signal.aborted) {
          pending.current = false;
          setBusy('');
        }
      }
    })();
    return () => {
      generation.current += 1;
      controller.current?.abort();
      pending.current = false;
    };
  }, [sourceId, reload]);

  const current = versions?.sourceId === sourceId ? versions : null;
  const confirmVersion = current?.versions.find(version => version.id === confirmId && !version.current);
  const locked = disabled || !!busy;
  const change = async (versionId?: string) => {
    if (pending.current || disabled || !current || (!versionId && !file)) return;
    if (versionId && (confirmId !== versionId || !current.versions.some(v => v.id === versionId && !v.current))) return;
    pending.current = true;
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(versionId ? '파일 버전 복원 중…' : '파일 검증 및 교체 중…');
    setError('');
    setNotice('');
    try {
      let response;
      if (versionId) {
        response = await post(
          `/database/${sourceId}/file-restore`,
          { expectedRevision: current.revision, versionId },
          { signal: abort.signal },
        );
      } else {
        const form = new FormData();
        form.append('file', file);
        form.append('expectedRevision', current.revision);
        response = await postForm(`/database/${sourceId}/file-replacement`, form, { signal: abort.signal, timeout: 360000 });
      }
      const fresh = unwrap(response, sourceId);
      if (token !== generation.current || abort.signal.aborted) return;
      setVersions(fresh);
      setFile(null);
      if (input.current) input.current.value = '';
      setConfirmId(null);
      const unchanged = fresh.unchanged === true || response.data.unchanged === true;
      setNotice(
        unchanged
          ? '같은 파일입니다. 현재 버전과 이력을 유지했습니다.'
          : versionId
          ? '선택한 파일 버전으로 복원했습니다.'
          : '검증을 완료하고 파일을 교체했습니다.',
      );
      if (!unchanged) onChanged();
    } catch (e: unknown) {
      if (token === generation.current && !abort.signal.aborted)
        setError(serverError(e, '파일 변경에 실패했습니다. 파일과 최신 버전을 확인한 뒤 다시 시도해 주세요.'));
    } finally {
      if (token === generation.current && !abort.signal.aborted) {
        pending.current = false;
        setBusy('');
      }
    }
  };

  return (
    <section aria-label="파일 교체 및 버전 관리" className="mt-6 min-w-0">
      <h3 className="mb-2 text-lg font-semibold">파일 교체 및 버전</h3>
      <p className="mb-4 text-sm">
        기존 열 이름과 타입이 모두 같은 파일만 교체할 수 있습니다. 열을 자동으로 연결하거나 변환하지 않습니다. 데이터
        소스·지표·차트는 유지되며, 현재 데이터가 바뀌면 연결된 대시보드에도 반영됩니다. 현재 버전을 포함해 최대 5개 버전을
        보관합니다.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="file"
          accept=".csv,.json,.parquet"
          aria-label="교체할 파일"
          disabled={locked || !current}
          className="hidden"
          onChange={event => {
            setFile(event.target.files?.[0] ?? null);
            setConfirmId(null);
            setError('');
            setNotice('');
          }}
        />
        <Button variant="outline" disabled={locked || !current} onClick={() => input.current?.click()}>
          파일 선택
        </Button>
        <p className="min-w-0 flex-1 break-words text-sm" aria-live="polite">
          {file ? `선택한 파일: ${file.name}` : '선택한 파일 없음'}
        </p>
        <Button disabled={locked || !current || !file} onClick={() => void change()}>
          검증 후 파일 교체
        </Button>
      </div>
      <p role="status" aria-live="polite" className="my-2">
        {busy || notice}
      </p>
      {error && (
        <Notice severity="error" className="mb-2">
          {error}
        </Notice>
      )}
      <Button variant="ghost" disabled={locked} onClick={() => setReload(value => value + 1)}>
        버전 목록 새로고침
      </Button>
      {current && (
        <>
          <div
            role="region"
            aria-label="파일 버전 목록"
            tabIndex={0}
            className="max-w-full overflow-x-auto text-xs sm:text-sm"
          >
            <Table style={{ width: '100%', tableLayout: 'fixed' }}>
              <TableCaption className="mt-0 mb-2 text-left text-inherit">보관된 파일 버전 · 최대 5개</TableCaption>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '28%' }} />
              </colgroup>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead scope="col" className="h-auto border-b px-2 py-1 text-left align-top whitespace-nowrap">
                    파일
                  </TableHead>
                  <TableHead scope="col" className="h-auto border-b px-2 py-1 text-right align-top whitespace-nowrap">
                    행 수
                  </TableHead>
                  <TableHead scope="col" className="h-auto border-b px-2 py-1 text-left align-top whitespace-nowrap">
                    업로드 시각
                  </TableHead>
                  <TableHead scope="col" className="h-auto border-b px-2 py-1 text-left align-top whitespace-nowrap">
                    복원
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.versions.map(version => {
                  const uploaded = timestamp(version.uploadedAt);
                  return (
                    <TableRow key={version.id} className="border-0 hover:bg-transparent">
                      <TableHead
                        scope="row"
                        className="h-auto border-b px-2 py-1 text-left align-top font-normal whitespace-normal"
                        style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}
                      >
                        {version.originalname}
                        {version.current && <span className="block whitespace-nowrap">현재 버전</span>}
                      </TableHead>
                      <TableCell className="border-b px-2 py-1 text-right align-top tabular-nums whitespace-normal">
                        {version.rows.toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell className="border-b px-2 py-1 align-top">
                        <time dateTime={version.uploadedAt}>
                          <span className="block whitespace-nowrap">{uploaded.day}</span>
                          <span className="block whitespace-nowrap">{uploaded.time}</span>
                        </time>
                      </TableCell>
                      <TableCell className="border-b px-2 py-1 align-top">
                        {!version.current && (
                          <Button
                            variant="ghost"
                            disabled={locked}
                            aria-label="이 버전으로 복원"
                            className="h-11 whitespace-nowrap px-1 text-inherit"
                            onClick={() => {
                              setConfirmId(version.id);
                              setError('');
                            }}
                          >
                            <span className="hidden sm:inline">이 버전으로 복원</span>
                            <span className="inline sm:hidden">복원</span>
                          </Button>
                        )}
                        {version.current && '사용 중'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {confirmVersion && (
            <section
              role="region"
              aria-label="파일 버전 복원 확인"
              aria-live="polite"
              className="mt-4 box-border w-full rounded-lg border p-4"
            >
              <p className="mb-2 break-words">복원할 파일: {confirmVersion.originalname}</p>
              <p className="mb-4">이 파일로 현재 데이터를 복원할까요? 연결된 대시보드 데이터도 바뀝니다.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={locked} onClick={() => void change(confirmVersion.id)}>
                  복원 확인
                </Button>
                <Button variant="ghost" disabled={locked} onClick={() => setConfirmId(null)}>
                  취소
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
