import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import { getToken } from '@/helpers/authHelper';
import { editorDraftKey } from '@/helpers/editorDraftStorage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Column = { name: string; type: string; numeric: boolean; nonAdditive?: boolean };
type Profile = {
  sourceId: number;
  dataVersion: string;
  columns?: Column[];
  supported: boolean;
  name: string;
  modelInfo?: any;
};
const keyType = /^(?:VARCHAR|CHAR|U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|UUID)(?:\(\d+\))?$/;
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS' || !response.data.data) throw new Error('서버 응답을 확인하지 못했습니다.');
  return response.data.data;
};
const errorText = (e: any) =>
  typeof e?.response?.data?.message === 'string'
    ? e.response.data.message
    : typeof e?.response?.data?.data?.message === 'string'
    ? e.response.data.data.message
    : '연결 상태를 확인하지 못했습니다. 입력과 이전 결과는 유지됩니다.';
export default function SourceModelBuilder({
  profile,
  sources,
  disabled = false,
}: {
  profile: Profile;
  sources: Array<{ id: number; name: string; engine: string }>;
  disabled?: boolean;
}) {
  const [lookupId, setLookupId] = useState(''),
    [lookup, setLookup] = useState<Profile | null>(null);
  const [factKey, setFactKey] = useState(''),
    [lookupKey, setLookupKey] = useState(''),
    [attrs, setAttrs] = useState<Record<string, string>>({});
  const [pathColumn, setPathColumn] = useState(''),
    [nonAdditive, setNonAdditive] = useState<string[]>((profile.columns ?? []).filter(c => c.nonAdditive).map(c => c.name));
  const [name, setName] = useState(profile.name + ' · 연결'),
    [preview, setPreview] = useState<any>(null),
    [created, setCreated] = useState<any>(null);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState<any>(null),
    [restoring, setRestoring] = useState(true);
  const storageKey = useRef<string | null>(null),
    mounted = useRef(true),
    sequence = useRef(0),
    saving = useRef(false);
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const key = await editorDraftKey(getToken(), profile.sourceId);
        if (!mounted.current) return;
        storageKey.current = key ? key + ':source-model' : null;
        const raw = storageKey.current && sessionStorage.getItem(storageKey.current);
        if (raw && raw.length <= 16384) {
          const record = JSON.parse(raw);
          if (
            record?.version === 1 &&
            record.factSourceId === profile.sourceId &&
            Number.isFinite(record.updatedAt) &&
            Date.now() - record.updatedAt < 86400000 &&
            record.updatedAt <= Date.now() + 60000 &&
            record.body?.spec?.factSourceId === profile.sourceId &&
            typeof record.body?.requestId === 'string'
          )
            setPending(record.body);
        }
      } catch {
        setError('저장 요청을 보관할 수 없습니다. 미리보기는 가능하지만 저장 전에 탭 저장소를 확인해 주세요.');
      } finally {
        if (mounted.current) setRestoring(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [profile.sourceId]);
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current,
      abort = new AbortController();
    setLookup(null);
    setLookupKey('');
    setAttrs({});
    setPreview(null);
    setCreated(null);
    setError('');
    if (lookupId) {
      setBusy('사전 데이터 확인 중…');
      void get(`/bi/sources/${lookupId}/profile`, undefined, { signal: abort.signal })
        .then(response => {
          if (token !== sequence.current || abort.signal.aborted) return;
          const p = unwrap(response);
          if (p.sourceId !== Number(lookupId) || !p.supported) throw new Error('지원하지 않는 소스');
          setLookup(p);
        })
        .catch(e => {
          if (!abort.signal.aborted && token === sequence.current) setError(errorText(e));
        })
        .finally(() => {
          if (token === sequence.current) setBusy('');
        });
    }
    return () => abort.abort();
  }, [lookupId, profile.sourceId]);
  const locked = disabled || restoring || !!busy || !!pending;
  const invalidate = () => {
    setPreview(null);
    setCreated(null);
    setError('');
  };
  const validate = async () => {
    if (locked || !lookup) return;
    setBusy('키와 연결 품질 확인 중…');
    setError('');
    setPreview(null);
    setCreated(null);
    try {
      const result = unwrap(
        await post('/bi/source-models/preview', {
          factSourceId: profile.sourceId,
          lookupSourceId: lookup.sourceId,
          factRevision: profile.dataVersion,
          lookupRevision: lookup.dataVersion,
          definition: {
            factKey,
            lookupKey,
            attributes: Object.entries(attrs).map(([column, alias]) => ({ column, alias })),
            ...(pathColumn ? { pathColumn } : {}),
            nonAdditiveColumns: nonAdditive,
          },
        }),
      );
      if (mounted.current) {
        setPreview(result);
        setConsent(false);
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy('');
    }
  };
  const [consent, setConsent] = useState(false);
  const confirm = async (body: any) => {
    if (saving.current || disabled) return;
    saving.current = true;
    setBusy('연결 소스 저장 확인 중…');
    setError('');
    try {
      const result = unwrap(await post('/bi/source-models/save', body));
      if (!Number.isSafeInteger(result.id) || result.id < 1) throw new Error('저장 응답 불명확');
      if (storageKey.current) sessionStorage.removeItem(storageKey.current);
      if (mounted.current) {
        setPending(null);
        setCreated(result);
      }
    } catch (e: any) {
      if (mounted.current) {
        setError(errorText(e));
        if (!e?.response?.status || e.response.status >= 500) setPending(body);
        else {
          if (storageKey.current) sessionStorage.removeItem(storageKey.current);
          setPending(null);
          setPreview(null);
        }
      }
    } finally {
      saving.current = false;
      if (mounted.current) setBusy('');
    }
  };
  const save = async () => {
    if (locked || created || !preview?.quality?.ready || !name.trim() || (preview.quality.unmatchedFactRows && !consent))
      return;
    const body = {
      spec: preview.spec,
      previewDigest: preview.previewDigest,
      requestId: crypto.randomUUID(),
      name: name.trim(),
      keepUnmatched: consent,
    };
    try {
      if (!storageKey.current) throw new Error();
      const record = JSON.stringify({ version: 1, updatedAt: Date.now(), factSourceId: profile.sourceId, body });
      if (new TextEncoder().encode(record).length > 16384) throw new Error('confirmation request too large');
      sessionStorage.setItem(storageKey.current, record);
    } catch {
      setError('같은 저장 요청을 보관하지 못해 전송하지 않았습니다. 탭 저장소를 확인해 주세요.');
      return;
    }
    setPending(body);
    await confirm(body);
  };
  const model = profile.modelInfo;
  return (
    <section aria-label="자료 연결과 품질" className="mt-6 min-w-0 rounded-xl border bg-muted/20 p-4">
      {model && (
        <div className="mb-4 text-sm">
          <p className="font-medium">연결 모델 · 원본 행 기준</p>
          <p className="mt-1 text-muted-foreground">
            원본 #{model.factSourceId} + 사전 #{model.lookupSourceId} · {model.quality?.outputRows?.toLocaleString('ko-KR')}
            행 · 미매칭 {model.quality?.unmatchedFactRows?.toLocaleString('ko-KR')}행. 생성 시점의 독립 스냅샷입니다.
          </p>
          {!!model.nonAdditiveColumns?.length && (
            <p className="mt-2 text-amber-800">
              {model.nonAdditiveColumns.join(', ')}: 사전의 숫자 속성·집계된 고유값은 재집계할 수 없습니다. 원본 사실 행 또는
              식별 키가 필요합니다.
            </p>
          )}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          자료 연결 · 키와 품질 확인
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          현재 데이터의 각 행을 유지하며 코드에 이름·분류를 붙입니다. 사전 키는 유일해야 하며 중복으로 금액이 늘어나는 연결은
          저장하지 않습니다. 추가 속성은 합산 지표가 아닌 범주입니다.
        </p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <TextField
            label="현재 데이터 연결 키"
            select
            value={factKey}
            disabled={locked}
            onChange={e => {
              setFactKey(e.target.value);
              invalidate();
            }}
          >
            <option value="">선택하세요</option>
            {(profile.columns ?? [])
              .filter(c => keyType.test(c.type))
              .map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
          </TextField>
          <TextField
            label="연결할 사전 데이터"
            select
            value={lookupId}
            disabled={locked}
            onChange={e => {
              setLookupId(e.target.value);
              invalidate();
            }}
          >
            <option value="">선택하세요</option>
            {sources
              .filter(s => s.engine === 'duckdb' && s.id !== profile.sourceId)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </TextField>
          {lookup && (
            <TextField
              label="사전의 유일 키"
              select
              value={lookupKey}
              disabled={locked}
              onChange={e => {
                setLookupKey(e.target.value);
                invalidate();
              }}
            >
              <option value="">선택하세요</option>
              {(lookup.columns ?? [])
                .filter(c => keyType.test(c.type))
                .map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </TextField>
          )}
          <TextField
            label="파일 경로 파생 차원 · 선택 사항"
            select
            value={pathColumn}
            disabled={locked}
            onChange={e => {
              setPathColumn(e.target.value);
              invalidate();
            }}
          >
            <option value="">사용 안 함</option>
            {(profile.columns ?? [])
              .filter(c => c.type === 'VARCHAR')
              .map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
          </TextField>
        </div>
        {lookup && (
          <fieldset className="mt-4 min-w-0 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">추가할 사전 속성 · 최대8개</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(lookup.columns ?? [])
                .filter(c => c.name !== lookupKey && !/STRUCT|MAP|\[/.test(c.type))
                .map(c => (
                  <div key={c.name} className="min-w-0">
                    <label className="flex items-center gap-2 text-sm break-all">
                      <Checkbox
                        aria-label={`추가 속성: ${c.name}`}
                        checked={c.name in attrs}
                        disabled={locked || (!(c.name in attrs) && Object.keys(attrs).length >= 8)}
                        onCheckedChange={checked => {
                          setAttrs(current => {
                            const next = { ...current };
                            if (checked === true)
                              next[c.name] = ('lookup_' + c.name.replace(/[^A-Za-z0-9_]/g, '_')).slice(0, 63);
                            else delete next[c.name];
                            return next;
                          });
                          invalidate();
                        }}
                      />
                      {c.name}
                    </label>
                    {c.name in attrs && (
                      <div className="mt-2">
                        <TextField
                          label={`${c.name} 출력 이름`}
                          value={attrs[c.name]}
                          disabled={locked}
                          maxLength={63}
                          onChange={e => {
                            setAttrs(current => ({ ...current, [c.name]: e.target.value }));
                            invalidate();
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </fieldset>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">집계된 고유값 안내 · 선택 사항</summary>
          <p className="my-2 text-xs text-muted-foreground">
            이미 그룹별로 센 고유 인원·고객 수를 선택하세요. 전체 고유값으로 더하거나 나눌 수 없게 표시합니다. 일반 금액·행별
            ID는 선택하지 마세요.
          </p>
          <div className="flex flex-wrap gap-3">
            {(profile.columns ?? [])
              .filter(c => c.numeric)
              .map(c => (
                <label key={c.name} className="flex items-center gap-2 break-all">
                  <Checkbox
                    aria-label={`비가산: ${c.name}`}
                    checked={nonAdditive.includes(c.name)}
                    disabled={locked || c.nonAdditive}
                    onCheckedChange={checked => {
                      setNonAdditive(current =>
                        checked === true ? [...current, c.name] : current.filter(n => n !== c.name),
                      );
                      invalidate();
                    }}
                  />
                  {c.name}
                </label>
              ))}
          </div>
        </details>
        <div className="my-4">
          <TextField
            label="새 연결 소스 이름"
            value={name}
            maxLength={100}
            disabled={locked}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={locked || !lookup || !factKey || !lookupKey || !Object.keys(attrs).length}
            onClick={() => void validate()}
          >
            연결 품질 미리보기
          </Button>
        </div>
        {preview && (
          <section aria-label="연결 품질 결과" className="mt-4 min-w-0 rounded-lg border bg-background p-3 text-sm">
            <p className="font-medium">{preview.quality.ready ? '원본 행 유지 확인' : '사전 키를 먼저 수정해 주세요'}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {[
                ['원본 행', 'factRows'],
                ['사전 행', 'lookupRows'],
                ['중복 사전 키', 'duplicateLookupKeys'],
                ['빈 사전 키', 'invalidLookupKeys'],
                ['미매칭 원본 행', 'unmatchedFactRows'],
                ['사용하지 않은 사전 행', 'unusedLookupRows'],
                ['연결 후 행', 'outputRows'],
              ].map(([label, key]) => (
                <React.Fragment key={key}>
                  <dt>{label}</dt>
                  <dd className="text-right tabular-nums">
                    {preview.quality[key] === null ? '확인 전' : preview.quality[key]?.toLocaleString('ko-KR')}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
            {!!preview.preview?.length && (
              <div role="region" aria-label="연결 결과 샘플 표" tabIndex={0} className="mt-3 max-w-full overflow-x-auto">
                <Table className="text-xs">
                  <TableCaption>연결 결과 · 처음 최대5행 · 전체 집계가 아닙니다</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview.preview[0]).map(k => (
                        <TableHead key={k} className="whitespace-nowrap">
                          {k}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row: any, i: number) => (
                      <TableRow key={i}>
                        {Object.keys(preview.preview[0]).map(k => (
                          <TableCell key={k} className="max-w-48 break-words">
                            {row[k] === null ? 'NULL' : String(row[k])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!!preview.quality.unmatchedFactRows && (
              <label className="mt-3 flex items-start gap-2">
                <Checkbox
                  aria-label="미매칭 행을 유지하는 데 동의"
                  checked={consent}
                  disabled={locked}
                  onCheckedChange={checked => setConsent(checked === true)}
                />
                <span>미매칭 행을 삭제하지 않고 유지합니다. 해당 사전 속성은 빈 값(NULL)으로 남는 데 동의합니다.</span>
              </label>
            )}
            {preview.quality.ready && !created && (
              <Button
                className="mt-4"
                disabled={locked || !name.trim() || !!(preview.quality.unmatchedFactRows && !consent)}
                onClick={() => void save()}
              >
                비공개 연결 소스 저장
              </Button>
            )}
          </section>
        )}
      </details>
      {busy && (
        <p role="status" className="mt-3 text-sm">
          {busy}
        </p>
      )}
      {error && (
        <Notice severity="error" className="mt-3">
          {error}
        </Notice>
      )}
      {pending && (
        <Notice severity="warning" className="mt-3">
          <p>연결 소스 저장 결과를 확인해야 합니다. 새 요청을 만들지 않고 같은 요청으로 확인합니다.</p>
          <Button className="mt-3" variant="outline" disabled={disabled || !!busy} onClick={() => void confirm(pending)}>
            같은 연결 저장 요청 확인
          </Button>
        </Notice>
      )}
      {created && (
        <Notice severity="info" className="mt-3">
          <p>
            {created.name} · 비공개 연결 소스 #{created.id} 저장 완료
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={`/explore?sourceId=${created.id}`}>연결 소스에서 탐색</Link>
            </Button>
            <Button asChild>
              <Link to={`/studio/new?sourceId=${created.id}`}>AI로 대시보드 만들기</Link>
            </Button>
          </div>
        </Notice>
      )}
    </section>
  );
}
