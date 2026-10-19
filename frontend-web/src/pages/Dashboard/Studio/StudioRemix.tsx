import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useNavigate, useParams } from 'react-router-dom';
import { getToken, STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import DatabaseService from '@/api/databaseService';
import { post } from '@/helpers/apiHelper';
import StudioSourcePicker from './StudioSourcePicker';
import { creationData, fetchStudioSources, SourceProfile, StudioSource } from './studioCreation';
import { studioRequestId } from './studioApi';
import { PublishedBlockView } from './PublishedDashboard';
import { studioDateRangeSummary, studioFilterChipText, studioFilterSummary } from './studioDocument';
import {
  canCreateRemix,
  fetchRemixRequirements,
  previewRemix,
  RemixInput,
  RemixPreview,
  RemixRequirements,
  RemixSaveInput,
  remixError,
  remixPreviewBlocks,
  saveRemix,
} from './studioRemixApi';
import './studio.css';
// UI response ownership only; authorization remains server-side. JWT identity survives refresh.
const actorKey = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const actor = payload.accessKeyData;
    if (Number.isSafeInteger(actor?.id) && actor.id > 0 && typeof actor.userId === 'string')
      return JSON.stringify([actor.id, actor.userId]);
  } catch {
    /* Malformed tokens remain isolated until server rejection. */
  }
  return token;
};
const statusLabel = { mapped: '연결됨', missing: '열 선택 필요', incompatible: '형식 불일치', ambiguous: '후보 확인 필요' };
export default function StudioRemix() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  return (
    <StudioRemixFlow
      token={token}
      onSave={async (request, isCurrent) => {
        const result = await saveRemix(token, request);
        if (isCurrent()) navigate('/dashboard/' + result.dashboardId + '/studio');
      }}
    />
  );
}

export function StudioRemixFlow({
  token,
  embedded = false,
  expectedVersion,
  onSave,
  onOriginRefresh,
}: {
  token: string;
  embedded?: boolean;
  expectedVersion?: number;
  onOriginRefresh?: () => void;
  onSave: (request: RemixSaveInput, isCurrent: () => boolean) => Promise<void>;
}) {
  const identity = useId().replace(/:/g, '');
  const elementId = (name: string) => identity + '-' + name;
  const [requirements, setRequirements] = useState<RemixRequirements | null>(null);
  const [sources, setSources] = useState<StudioSource[]>([]),
    [sourceId, setSourceId] = useState<number | null>(null);
  const [profile, setProfile] = useState<SourceProfile | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]),
    [preview, setPreview] = useState<RemixPreview | null>(null);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [login, setLogin] = useState(!getToken());
  const pendingSave = useRef<RemixSaveInput | null>(null),
    epoch = useRef(0),
    activeActor = useRef(actorKey()),
    mounted = useRef(true),
    abort = useRef<AbortController | null>(null);
  const received = /^(?:d|g)-/.test(token);
  const path = received ? '/received/' + token.split('-')[3] : '/published/' + encodeURIComponent(token);
  const initialize = useCallback(async () => {
    epoch.current += 1;
    const generation = epoch.current;
    activeActor.current = actorKey();
    abort.current?.abort();
    pendingSave.current = null;
    setRequirements(null);
    setPreview(null);
    setProfile(null);
    setSourceId(null);
    setMapping({});
    setExcluded([]);
    setError('');
    setNotice('');
    if (!getToken()) {
      setLogin(true);
      setSources([]);
      setBusy('');
      return;
    }
    setLogin(false);
    setBusy('복제 가능한 정의와 내 데이터를 확인하고 있습니다…');
    try {
      const [template, rows] = await Promise.all([fetchRemixRequirements(token), fetchStudioSources()]);
      if (!mounted.current || generation !== epoch.current) return;
      if (expectedVersion !== undefined && template.version !== expectedVersion) throw { response: { status: 409 } };
      setRequirements(template);
      setSources(rows);
    } catch (cause: any) {
      if (mounted.current && generation === epoch.current) {
        setError(remixError(cause, received));
        if (cause?.response?.status === 401) setLogin(true);
      }
    } finally {
      if (mounted.current && generation === epoch.current) setBusy('');
    }
  }, [token, expectedVersion]);
  useEffect(() => {
    mounted.current = true;
    initialize();
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_ACCESS_TOKEN && activeActor.current !== actorKey()) initialize();
    };
    window.addEventListener('storage', storage);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      abort.current?.abort();
      window.removeEventListener('storage', storage);
    };
  }, [initialize]);
  const check = async (id: number, selectedMapping: Record<string, string>, excludedIds: string[]) => {
    if (!requirements || pendingSave.current || !Number.isSafeInteger(id) || id <= 0) return;
    epoch.current += 1;
    const generation = epoch.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPreview(null);
    setBusy('필수 열과 형식을 확인하고 집계를 계산하고 있습니다…');
    setError('');
    setNotice('');
    const body: RemixInput = {
      targetSourceId: id,
      mapping: selectedMapping,
      excludedBlockIds: excludedIds,
      expectedVersion: requirements.version,
      expectedLifecycleRevision: requirements.lifecycleRevision,
    };
    try {
      const next = await previewRemix(token, body, controller.signal);
      if (!mounted.current || generation !== epoch.current || controller.signal.aborted) return;
      setProfile(next.profile);
      setMapping({ ...selectedMapping, ...next.mapping });
      setPreview(next);
      setNotice(
        next.unmappedBlocks.length
          ? '필수 열이 연결되지 않은 블록이 있습니다. 열을 연결하거나 해당 블록을 직접 제외해 주세요.'
          : '내 데이터의 계산 결과를 확인했습니다. 아직 저장되지 않았습니다.',
      );
    } catch (cause: any) {
      if (mounted.current && generation === epoch.current && !controller.signal.aborted) {
        setError(remixError(cause, received));
        if (cause?.response?.status === 401) setLogin(true);
      }
    } finally {
      if (mounted.current && generation === epoch.current) setBusy('');
    }
  };
  const choose = (id: number) => {
    if (pendingSave.current) return;
    setSourceId(id);
    setProfile(null);
    setMapping({});
    check(id, {}, excluded);
  };
  const invalidate = () => {
    epoch.current += 1;
    abort.current?.abort();
    setPreview(null);
    setNotice('연결이 변경되었습니다. 매핑 확인을 눌러 새 조건을 검증해 주세요.');
    setError('');
  };
  const prepare = async (task: () => Promise<number>) => {
    if (busy || pendingSave.current) return;
    epoch.current += 1;
    const generation = epoch.current;
    setBusy('파일을 서버 DuckDB에 준비하고 있습니다…');
    setError('');
    setPreview(null);
    try {
      const id = await task();
      if (!mounted.current || generation !== epoch.current) return;
      const rows = await fetchStudioSources();
      if (!mounted.current || generation !== epoch.current) return;
      setSources(rows);
      choose(id);
    } catch (cause) {
      if (mounted.current && generation === epoch.current) {
        setError(remixError(cause, received));
        setBusy('');
      }
    }
  };
  const create = async () => {
    if (busy || !preview || !canCreateRemix(preview, excluded) || !sourceId) return;
    if (!pendingSave.current)
      pendingSave.current = {
        requestId: studioRequestId(),
        targetSourceId: sourceId,
        mapping: { ...preview.mapping },
        excludedBlockIds: [...excluded],
        expectedVersion: preview.version,
        expectedLifecycleRevision: preview.lifecycleRevision,
        expectedSourceRevision: preview.sourceRevision,
      };
    const request = pendingSave.current;
    const generation = epoch.current;
    const actor = actorKey();
    const isCurrent = () => mounted.current && generation === epoch.current && actor === actorKey();
    setBusy('새 비공개 대시보드로 저장하고 있습니다…');
    setError('');
    setNotice('');
    try {
      await onSave(request, isCurrent);
      if (!isCurrent()) return;
      if (pendingSave.current === request) pendingSave.current = null;
    } catch (cause: any) {
      if (!isCurrent()) return;
      if (cause?.response?.status && cause.response.status < 500 && pendingSave.current === request)
        pendingSave.current = null;
      setError(remixError(cause, received));
      if (pendingSave.current === request)
        setNotice('저장 완료 여부를 확인하지 못했습니다. 같은 요청으로 재시도하면 기존 저장 결과를 확인합니다.');
    } finally {
      if (isCurrent()) setBusy('');
    }
  };
  const locked = !!busy || !!pendingSave.current;
  const activeFields = requirements?.requiredFields.filter(field => field.blockIds.some(id => !excluded.includes(id))) ?? [];
  return (
    <div className={'vm-studio studio-remix' + (embedded ? ' studio-remix-inline' : '')}>
      {!embedded && (
        <a className="studio-skip" href={'#' + elementId('main')}>
          복제 설정으로 건너뛰기
        </a>
      )}
      {!embedded && (
        <>
          <div className="studio-notice">
            <span className="studio-dot" />새 비공개 대시보드 · 원본은 변경되지 않습니다
          </div>
          <header className="studio-remix-header">
            <div>
              <span className="studio-eyebrow">DASHBOARD STUDIO · REMIX</span>
              <h1>내 데이터로 복제</h1>
            </div>
            <Button asChild variant="ghost" className={pendingSave.current ? 'pointer-events-none opacity-50' : undefined}>
              <a
                href={received ? '/organization' : path}
                aria-disabled={!!pendingSave.current || undefined}
                tabIndex={pendingSave.current ? -1 : undefined}
                onClick={event => {
                  if (pendingSave.current) event.preventDefault();
                }}
              >
                {received ? '받은 자료로 돌아가기' : '게시본으로 돌아가기'}
              </a>
            </Button>
          </header>
        </>
      )}
      <div id={elementId('main')} className="studio-remix-main">
        {busy && (
          <Notice severity="info" role="status">
            {busy}
          </Notice>
        )}
        {error && <Notice severity="error">{error}</Notice>}
        {notice && (
          <Notice severity={preview?.unmappedBlocks.length ? 'warning' : 'info'} role="status">
            {notice}
          </Notice>
        )}
        {login ? (
          <section className="studio-remix-login">
            <h2>내 데이터를 쓰려면 로그인해 주세요</h2>
            <p>
              별도 창에서 로그인한 뒤 이 화면으로 돌아오세요. 원본의 데이터를 가져오지 않고 내 소유 데이터에 지표를
              연결합니다.
            </p>
            <Button asChild>
              <a href="/login" target="_blank" rel="noopener noreferrer">
                별도 창에서 로그인
              </a>
            </Button>
            <Button variant="outline" onClick={received && onOriginRefresh ? onOriginRefresh : initialize}>
              로그인 후 다시 확인
            </Button>
          </section>
        ) : (
          <>
            {!requirements && !busy && (
              <Button variant="outline" onClick={received && onOriginRefresh ? onOriginRefresh : initialize}>
                복제 정의 다시 확인
              </Button>
            )}
            {requirements && (
              <>
                <section className="studio-remix-origin">
                  <span className="studio-eyebrow">
                    {received ? '받은 분석' : '원본 게시본'} · V{requirements.version}
                  </span>
                  <h2>{requirements.title}</h2>
                  <p>구조화된 지표와 배치를 가져옵니다. 원본 파일·연결 정보·공유 링크·실행 이력은 복사하지 않습니다.</p>
                  {!!requirements.filters?.length && (
                    <div className="studio-published-filters" role="note" aria-label="원본 게시본 공통 필터">
                      <span className="studio-eyebrow">원본 공통 필터 · 읽기 전용</span>
                      {requirements.filters.map(filter => (
                        <span className="studio-published-filter" key={filter.column}>
                          {studioFilterChipText(filter)}
                        </span>
                      ))}
                    </div>
                  )}
                  {requirements.conditions && (
                    <p role="note" className="min-w-0 break-words">
                      포함·제외 조건이 있는 게시본입니다. 모든 조건 열을 연결해야 하며 조건을 제거한 복사본은 만들지
                      않습니다.
                    </p>
                  )}
                  {requirements.dateRange && (
                    <div className="studio-published-filters" role="note" aria-label="원본 게시본 공통 기간">
                      <span className="studio-eyebrow">원본 공통 기간 · 읽기 전용</span>
                      <span className="studio-published-filter">{studioDateRangeSummary(requirements.dateRange)}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={received && onOriginRefresh ? onOriginRefresh : initialize}
                    disabled={locked}
                  >
                    {received ? '공유 원본' : '게시 정의'} 새로 확인 (매핑 초기화)
                  </Button>
                </section>
                <div className="studio-remix-columns">
                  <StudioSourcePicker
                    idPrefix={identity}
                    sources={sources}
                    sourceId={sourceId}
                    profile={profile && Number.isFinite(Number(profile.rowCount)) ? profile : null}
                    busy={locked}
                    onSource={choose}
                    onRefresh={() => {
                      if (sourceId) check(sourceId, mapping, excluded);
                    }}
                    onFile={file =>
                      prepare(async () => {
                        const data = creationData(await DatabaseService.uploadFile(file));
                        if (!Number.isSafeInteger(data?.id)) throw new Error('file');
                        return data.id;
                      })
                    }
                    onSample={sample =>
                      prepare(async () => {
                        const data = creationData(await post('/studio/samples', { sample }, { timeout: 360000 }));
                        if (!Number.isSafeInteger(data?.sourceId)) throw new Error('sample');
                        return data.sourceId;
                      })
                    }
                  />
                  <section className="studio-remix-mapping" aria-labelledby={elementId('mapping-heading')}>
                    <span className="studio-eyebrow">02 · 열 연결</span>
                    <h2 id={elementId('mapping-heading')}>내 열에 지표를 연결하세요</h2>
                    <p>
                      이름과 형식이 정확히 같으면 자동 연결합니다. 숫자·문자열 변환이나 불확실한 후보는 추측하지 않습니다.
                    </p>
                    {!sourceId ? (
                      <div className="studio-remix-empty">먼저 내 데이터를 선택하세요.</div>
                    ) : (
                      <>
                        <div className="studio-remix-field-list">
                          {activeFields.map(field => {
                            const status = preview?.fields.find(item => item.sourceColumn === field.name);
                            return (
                              <div className="studio-remix-field" key={field.name}>
                                <Label
                                  htmlFor={elementId('field-' + encodeURIComponent(field.name))}
                                  className="block min-w-0"
                                >
                                  <strong>{field.name}</strong>
                                  <small id={elementId('status-' + encodeURIComponent(field.name))}>
                                    {field.type} · {status ? statusLabel[status.status] : '확인 필요'}
                                  </small>
                                </Label>
                                <TextField
                                  select
                                  id={elementId('field-' + encodeURIComponent(field.name))}
                                  aria-label={'대상 열: ' + field.name}
                                  aria-describedby={elementId('status-' + encodeURIComponent(field.name))}
                                  aria-invalid={!!status && status.status !== 'mapped'}
                                  value={
                                    Object.prototype.hasOwnProperty.call(mapping, field.name) ? mapping[field.name] : ''
                                  }
                                  disabled={locked || !profile}
                                  onChange={event => {
                                    invalidate();
                                    setMapping(value => ({ ...value, [field.name]: event.target.value }));
                                  }}
                                >
                                  <option value="">연결할 내 열을 선택하세요</option>
                                  {profile?.columns.map(column => (
                                    <option key={column.name} value={column.name}>
                                      {column.name} · {column.type}
                                    </option>
                                  ))}
                                </TextField>
                              </div>
                            );
                          })}
                        </div>
                        {!activeFields.length && <p>남은 블록에는 연결할 원본 열이 없습니다.</p>}
                        <Button variant="outline" onClick={() => check(sourceId, mapping, excluded)} disabled={locked}>
                          매핑 확인
                        </Button>
                      </>
                    )}
                    <div className="studio-remix-blocks">
                      <h3>복제할 블록</h3>
                      <p>제외를 선택한 블록과 배치는 새 대시보드에서 함께 빠집니다.</p>
                      {requirements.blocks.map(block => {
                        const issue = preview?.unmappedBlocks.find(item => item.blockId === block.id);
                        return (
                          <div
                            className={
                              'studio-remix-block' + (issue || !block.supported ? ' studio-remix-block-warning' : '')
                            }
                            key={block.id}
                          >
                            <strong>{block.title}</strong>
                            <span>
                              {block.kind === 'BOARD_NUMERIC'
                                ? '숫자 지표'
                                : block.kind === 'CHART_LINE'
                                ? '시간 차트'
                                : '차원 차트'}
                            </span>
                            {(issue || !block.supported) && (
                              <p>
                                {issue?.reason ?? block.reason ?? '지원하지 않는 의미 정의입니다.'}
                                {issue?.missingFields.length ? ' · ' + issue.missingFields.join(', ') : ''}
                              </p>
                            )}
                            <div className="flex min-w-0 items-start gap-2">
                              <Checkbox
                                id={elementId('exclude-' + block.id)}
                                className="mt-0.5"
                                checked={excluded.includes(block.id)}
                                disabled={locked}
                                onCheckedChange={checked => {
                                  invalidate();
                                  setExcluded(value =>
                                    checked === true ? [...value, block.id] : value.filter(id => id !== block.id),
                                  );
                                }}
                              />
                              <Label htmlFor={elementId('exclude-' + block.id)} className="min-w-0 leading-5 break-words">
                                {block.title + ' 제외'}
                              </Label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
                {!!preview?.unmappedFilters?.length && (
                  <Notice severity="warning" role="alert">
                    원본 게시본의 공통 필터 {preview.unmappedFilters.length}개 열을 대상 데이터에 적용할 수 없습니다:{' '}
                    {preview.unmappedFilters.join(', ')}. 이 미리보기는 필터가 전혀 없는 전체 범위 결과가 아닙니다. 각 필터에
                    형식이 맞는 대상 열을 선택한 뒤 매핑 확인을 눌러 주세요.
                  </Notice>
                )}
                {!!preview?.unmappedConditions?.length && (
                  <Notice severity="warning">
                    포함·제외 조건 열을 연결할 수 없습니다: {preview.unmappedConditions.join(', ')}. 모든 조건 열을 연결해야
                    저장할 수 있습니다.
                  </Notice>
                )}
                {preview?.mappedConditions && <p role="note">포함·제외 조건 적용됨 · 읽기 전용</p>}
                {preview?.unmappedDateRange && (
                  <Notice severity="warning" role="alert">
                    저장된 기간 열 '{preview.unmappedDateRange}'을(를) 대상 데이터에서 확인할 수 없습니다. 기간이 빠진 결과로
                    복제하지 않도록 저장은 서버에서 차단됩니다. 대상 소스에서 형식이 맞는 날짜 열을 확인한 뒤 매핑 확인을
                    눌러 주세요.
                  </Notice>
                )}
                {preview?.preview && (
                  <section className="studio-remix-preview" aria-labelledby={elementId('preview-heading')}>
                    <span className="studio-eyebrow">03 · 내 데이터의 계산 결과</span>
                    <h2 id={elementId('preview-heading')}>저장 전 결과를 확인하세요</h2>
                    <p>원본 게시 숫자를 복사하지 않고 선택한 내 데이터에서 다시 집계했습니다.</p>
                    <p className="studio-remix-filter-scope">
                      {preview.mappedFilters?.length
                        ? '적용 조건 · ' + studioFilterSummary(preview.mappedFilters)
                        : requirements.filters?.length
                        ? '적용된 공통 필터를 확인하지 못했습니다. 전체 범위 결과로 단정하지 마세요.'
                        : '공통 필터 없음 · 전체 범위'}
                    </p>
                    <p className="studio-remix-filter-scope">
                      {preview.mappedDateRange
                        ? '적용 기간 · ' + studioDateRangeSummary(preview.mappedDateRange)
                        : requirements.dateRange
                        ? '저장된 기간을 이 미리보기에 적용하지 못했습니다. 전체 기간 결과로 단정하지 마세요.'
                        : '기간 전체'}
                    </p>
                    <div className="studio-remix-preview-grid">
                      {remixPreviewBlocks(preview).map(block => (
                        <article
                          className="studio-published-card"
                          key={block.id}
                          aria-label={block.title + ' 복제 미리보기'}
                        >
                          <PublishedBlockView block={block} />
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                <div className="studio-remix-save">
                  <p>새 지표·차트와 대시보드는 비공개로 생성됩니다. 저장 후 Studio에서 제목·표현·배치를 편집하세요.</p>
                  <Button disabled={!!busy || !canCreateRemix(preview, excluded)} onClick={create}>
                    {pendingSave.current ? '같은 복제 저장 재시도' : '새 비공개 대시보드 만들기'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
