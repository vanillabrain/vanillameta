import React, { useEffect, useRef, useState } from 'react';
import { get, post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';

type Source = { id: number; name: string; engine: string };
type Diagnosis = {
  sourceId: number;
  requestId: string;
  targetSourceId: number;
  sourceRevision: string;
  targetRevision: string;
  dependencyRevision: string;
  explanation: string;
  mappings: { from: string; to: string }[];
  missingColumns: string[];
  repaired: false;
  observedChanges: {
    kind: 'removed' | 'added' | 'typeChanged';
    column: string;
    previousType?: string;
    incomingType?: string;
  }[];
};
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('응답을 확인하지 못했습니다.');
  return response.data.data;
};
export default function FileSchemaDiagnosis({
  sourceId,
  requestId,
  sourceRevision,
  dependencyRevision,
}: {
  sourceId: number;
  requestId: string;
  sourceRevision: string;
  dependencyRevision: string;
}) {
  const [sources, setSources] = useState<Source[]>([]),
    [target, setTarget] = useState('');
  const [profile, setProfile] = useState<{ sourceId: number; dataVersion: string } | null>(null);
  const [question, setQuestion] = useState(
    '왜 파일 교체가 거절됐나요? 모든 블록을 유지하며 새 데이터의 열 연결 수정안을 제안해 주세요.',
  );
  const [data, setData] = useState<Diagnosis | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      sequence.current += 1;
      request.current?.abort();
    },
    [],
  );
  const change = () => {
    sequence.current += 1;
    request.current?.abort();
    pending.current = false;
    setBusy('');
    setData(null);
    setError('');
  };
  const run = async (kind: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return;
    sequence.current += 1;
    const token = sequence.current,
      abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy(kind);
    setError('');
    setData(null);
    try {
      await action(abort.signal);
    } catch (failure: any) {
      if (sequence.current === token && !abort.signal.aborted) {
        const status = failure?.response?.status;
        setError(
          status === 409
            ? '진단 기준이 바뀌었습니다. 영향 목록과 대체 소스를 다시 확인해 주세요.'
            : status === 401 || status === 403
            ? '이 소스를 조회할 권한을 확인해 주세요.'
            : '진단 결과를 확인하지 못했습니다. 질문과 기존 성공본을 유지했습니다. 다시 시도해 주세요.',
        );
      }
    } finally {
      if (sequence.current === token) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const load = () =>
    run('sources', async signal => {
      const rows = unwrap(await get('/bi/sources', undefined, { signal }));
      if (signal.aborted) return;
      if (!Array.isArray(rows) || !rows.every(s => Number.isSafeInteger(s.id) && typeof s.name === 'string'))
        throw new Error('sources');
      setSources(rows.filter(s => s.engine === 'duckdb' && s.id !== sourceId));
    });
  const select = (id: string) => {
    change();
    setTarget(id);
    setProfile(null);
    if (id)
      void run('profile', async signal => {
        const value = unwrap(await get(`/bi/sources/${id}/profile`, undefined, { signal }));
        if (signal.aborted) return;
        if (value?.sourceId !== Number(id) || !value.supported || !/^[a-f0-9]{64}$/.test(value.dataVersion))
          throw new Error('profile');
        setProfile({ sourceId: value.sourceId, dataVersion: value.dataVersion });
      });
  };
  const diagnose = () =>
    run('diagnosis', async signal => {
      if (!profile || !question.trim()) throw new Error('input');
      const result = unwrap(
        await post(
          `/bi/sources/${sourceId}/file-refreshes/${requestId}/impact/diagnosis`,
          {
            question,
            targetSourceId: profile.sourceId,
            expectedSourceRevision: sourceRevision,
            expectedTargetRevision: profile.dataVersion,
            expectedDependencyRevision: dependencyRevision,
          },
          { signal, timeout: 180000 },
        ),
      );
      if (signal.aborted) return;
      if (
        result?.sourceId !== sourceId ||
        result.requestId !== requestId ||
        result.targetSourceId !== profile.sourceId ||
        result.sourceRevision !== sourceRevision ||
        result.targetRevision !== profile.dataVersion ||
        result.dependencyRevision !== dependencyRevision ||
        result.repaired !== false ||
        typeof result.explanation !== 'string' ||
        result.explanation.length > 1000 ||
        !Array.isArray(result.mappings) ||
        result.mappings.length > 128 ||
        !result.mappings.every(
          m => typeof m.from === 'string' && typeof m.to === 'string' && m.from.length <= 128 && m.to.length <= 128,
        ) ||
        !Array.isArray(result.missingColumns) ||
        result.missingColumns.length > 128 ||
        !result.missingColumns.every(c => typeof c === 'string' && c.length <= 128) ||
        !Array.isArray(result.observedChanges) ||
        result.observedChanges.length > 75 ||
        !result.observedChanges.every(
          c =>
            ['removed', 'added', 'typeChanged'].includes(c.kind) &&
            typeof c.column === 'string' &&
            c.column.length <= 128 &&
            (c.previousType === undefined || typeof c.previousType === 'string') &&
            (c.incomingType === undefined || typeof c.incomingType === 'string'),
        )
      )
        throw new Error('diagnosis');
      setData(result);
    });
  return (
    <section aria-label="AI 열 오류 진단" className="min-w-0 space-y-3 rounded-lg border bg-background p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="min-w-0 flex-1 text-sm font-semibold">AI와 오류 원인 확인</h5>
        <Button variant="outline" disabled={!!busy} onClick={() => void load()}>
          대체 소스 목록 확인
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Codex · gpt-6-luna에 열 이름·타입·저장 의존성만 전달합니다. 원본 값·경로는 전송하지 않습니다. 제안은 자동 적용되지
        않습니다.
      </p>
      <TextField label="진단할 대체 데이터" select value={target} disabled={!!busy} onChange={e => select(e.target.value)}>
        <option value="">새 파일로 올린 소스를 선택하세요</option>
        {sources.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </TextField>
      <TextField
        label="오류에 관해 질문하기"
        multiline
        minRows={3}
        value={question}
        maxLength={1000}
        disabled={!!busy}
        onChange={e => {
          change();
          setQuestion(e.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!!busy || !profile || !question.trim()} onClick={() => void diagnose()}>
          {busy === 'diagnosis' ? '진단 제안 준비 중…' : '원인과 열 연결 제안'}
        </Button>
        {busy === 'diagnosis' && (
          <Button variant="outline" onClick={change}>
            진단 취소
          </Button>
        )}
      </div>
      {error && <Notice severity="error">{error}</Notice>}
      {data && (
        <div
          aria-label="AI 진단 제안"
          className="min-w-0 space-y-3 rounded-md border bg-muted/20 p-3 [overflow-wrap:anywhere]"
        >
          <p className="text-xs font-semibold text-muted-foreground">서버에서 확인한 거절 파일의 변경</p>
          <ul className="space-y-1 text-sm">
            {data.observedChanges.map((c, i) => (
              <li key={i}>
                {c.kind === 'removed' ? '삭제' : c.kind === 'added' ? '추가' : '타입 변경'}: {c.column}
                {c.previousType ? ` (${c.previousType})` : ''}
                {c.incomingType ? ` → ${c.incomingType}` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs font-semibold text-muted-foreground">AI 연결 제안 · 적용 전</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.explanation}</p>
          <ul className="space-y-1 text-sm">
            {data.mappings.map(m => (
              <li key={m.from}>
                <span className="font-medium">{m.from}</span> → {m.to}
              </li>
            ))}
          </ul>
          {data.missingColumns.length > 0 && (
            <Notice severity="warning">
              미해결 열: {data.missingColumns.join(', ')}. 필요한 자료를 준비하고 다시 질문하세요.
            </Notice>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            아직 복구·저장하지 않았습니다. 아래 분석의 복사·열 연결 화면에서{' '}
            <strong>{sources.find(s => s.id === data.targetSourceId)?.name}</strong>을 선택하고, 의미·단위를 확인해 직접
            연결하세요. 모든 블록 미리보기 후 비공개 복사본으로 저장합니다.
          </p>
        </div>
      )}
    </section>
  );
}
