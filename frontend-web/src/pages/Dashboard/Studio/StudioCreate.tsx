import React, { useEffect, useRef, useState } from 'react';
import IconLogo from '@/assets/images/logo.svg?react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { TextField } from '@/components/ui/text-field';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import DatabaseService from '@/api/databaseService';
import { studioRequestId } from './studioApi';
import {
  CreationProposal,
  creationData,
  creationError,
  fetchStudioSources,
  proposeStudio,
  SourceProfile,
  StudioSource,
} from './studioCreation';
import StudioSourcePicker from './StudioSourcePicker';
import StudioSemanticReview from './StudioSemanticReview';
import './studio.css';
export default function StudioCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sources, setSources] = useState<StudioSource[]>([]),
    [sourceId, setSourceId] = useState<number | null>(null),
    [profile, setProfile] = useState<SourceProfile | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]),
    [selectedMetrics, setSelectedMetrics] = useState<number[]>([]);
  const [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<CreationProposal | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const epoch = useRef(0),
    mounted = useRef(true),
    pending = useRef(false),
    abort = useRef<AbortController | null>(null);
  const creation = useRef<{ requestId: string; proposalId: string; expectedSourceRevision: string } | null>(null);
  const invalidate = () => {
    epoch.current += 1;
    abort.current?.abort();
    abort.current = null;
    setProposal(null);
    setAnswers({});
    creation.current = null;
  };
  const loadSources = async () => {
    const rows = await fetchStudioSources();
    if (mounted.current) setSources(rows);
    return rows;
  };
  const choose = async (id: number) => {
    invalidate();
    const generation = epoch.current;
    setSourceId(id);
    setProfile(null);
    setMetrics([]);
    setSelectedMetrics([]);
    setError('');
    setNotice('');
    setBusy('source');
    try {
      const [p, m] = await Promise.all([get('/bi/sources/' + id + '/profile'), get('/bi/metrics', { sourceId: id })]);
      if (!mounted.current || generation !== epoch.current) return;
      const data = creationData(p);
      if (!data?.supported || data.sourceId !== id || !Array.isArray(data.columns)) throw new Error('unsupported');
      setProfile(data);
      setMetrics(creationData(m));
    } catch (cause) {
      if (mounted.current && generation === epoch.current) setError(creationError(cause));
    } finally {
      if (mounted.current && generation === epoch.current) setBusy('');
    }
  };
  useEffect(() => {
    mounted.current = true;
    const initialEpoch = epoch.current;
    fetchStudioSources()
      .then(rows => {
        if (!mounted.current || epoch.current !== initialEpoch) return;
        setSources(rows);
        const initial = Number(params.get('sourceId'));
        if (initial > 0 && rows.some(row => row.id === initial && row.engine === 'duckdb')) choose(initial);
      })
      .catch(cause => {
        if (mounted.current && epoch.current === initialEpoch) setError(creationError(cause));
      });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      abort.current?.abort();
    };
  }, []);
  const prepareSource = async (
    task: () => Promise<number>,
    label: string,
    context: 'file' | 'generation' = 'generation',
  ) => {
    if (pending.current) return;
    pending.current = true;
    invalidate();
    setBusy(label);
    setError('');
    const generation = epoch.current;
    try {
      const id = await task();
      if (!mounted.current || generation !== epoch.current) return;
      await loadSources();
      if (!mounted.current || generation !== epoch.current) return;
      await choose(id);
    } catch (cause) {
      if (mounted.current && generation === epoch.current) setError(creationError(cause, context));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy('');
    }
  };
  const upload = (file: File) =>
    prepareSource(
      async () => {
        const data = creationData(await DatabaseService.uploadFile(file));
        if (!Number.isSafeInteger(data?.id)) throw new Error('invalid upload');
        return data.id;
      },
      '파일을 서버에 저장하는 중입니다…',
      'file',
    );
  const sample = (sample: 'rill' | 'commerce') =>
    prepareSource(async () => {
      const data = creationData(await post('/studio/samples', { sample }, { timeout: 360000 }));
      if (!Number.isSafeInteger(data?.sourceId)) throw new Error('invalid sample');
      return data.sourceId;
    }, '샘플을 서버에 준비하는 중입니다…');
  const generate = async () => {
    if (pending.current || !sourceId || !profile || !prompt.trim()) return;
    const old = proposal;
    pending.current = true;
    epoch.current += 1;
    const generation = epoch.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy('AI가 지표 정의와 계산을 준비하고 있습니다…');
    setError('');
    setNotice('');
    setProposal(old?.clarifications?.length ? old : null);
    creation.current = null;
    try {
      const next = await proposeStudio(
        {
          sourceId,
          prompt: prompt.trim(),
          ...(selectedMetrics.length ? { selectedMetricIds: selectedMetrics } : {}),
          ...(Object.keys(answers).length ? { clarificationAnswers: answers } : {}),
          ...(old ? { expectedSourceRevision: old.sourceRevision } : {}),
        },
        controller.signal,
      );
      if (!mounted.current || generation !== epoch.current || controller.signal.aborted) return;
      setProposal(next);
      setNotice(
        next.clarifications?.length
          ? '계산 전에 업무 의미 확인이 필요합니다.'
          : '계산 결과가 준비됐습니다. 지표 정의를 확인한 뒤 저장하세요.',
      );
    } catch (cause) {
      if (mounted.current && generation === epoch.current && !controller.signal.aborted) setError(creationError(cause));
    } finally {
      if (mounted.current && generation === epoch.current) {
        setBusy('');
        pending.current = false;
        abort.current = null;
      }
    }
  };
  const cancel = () => {
    epoch.current += 1;
    abort.current?.abort();
    abort.current = null;
    pending.current = false;
    setBusy('');
    setNotice('생성을 취소했습니다. 데이터와 입력은 유지됩니다.');
  };
  const save = async () => {
    if (pending.current || !proposal?.preview || proposal.clarifications?.length) return;
    pending.current = true;
    setBusy('Studio에 저장하는 중입니다…');
    setError('');
    try {
      if (!creation.current)
        creation.current = {
          requestId: studioRequestId(),
          proposalId: proposal.proposalId,
          expectedSourceRevision: proposal.sourceRevision,
        };
      const data = creationData(await post('/studio/dashboards', creation.current, { timeout: 180000 }));
      if (!Number.isSafeInteger(data?.dashboardId) || data.dashboardId <= 0) throw new Error('invalid create');
      if (mounted.current) navigate('/dashboard/' + data.dashboardId + '/studio');
    } catch (cause) {
      if (mounted.current) setError(creationError(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy('');
    }
  };
  return (
    <div className="vm-studio studio-create-page">
      <a className="studio-skip" href="#studio-create-main">
        생성 내용으로 건너뛰기
      </a>
      <header className="studio-create-header">
        <Link to="/dashboard" className="studio-create-brand" aria-label="VanillaMeta">
          <IconLogo aria-hidden="true" />
        </Link>
        <div>
          <span className="studio-eyebrow">DASHBOARD STUDIO</span>
          <h1>내 데이터로 시작하기</h1>
        </div>
        <Button variant="outline" asChild>
          <Link to="/dashboard">대시보드 목록</Link>
        </Button>
      </header>
      <main id="studio-create-main" className="studio-create-main">
        <div className="studio-create-intro">
          <span className="studio-eyebrow">데이터 → 지표 확인 → Studio</span>
          <h2>질문 하나에서 시작하는 대시보드</h2>
          <p>데이터를 고르고 보고 싶은 내용을 적어 주세요. AI가 제안한 계산을 확인하고 편집을 이어갈 수 있습니다.</p>
        </div>
        {error && (
          <Alert severity="error" className="studio-create-alert">
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="info" className="studio-create-alert">
            {notice}
          </Alert>
        )}
        {busy && (
          <div role="status" className="studio-create-busy">
            <Spinner />
            <span>{busy === 'source' ? '데이터 구조를 확인하는 중입니다…' : busy}</span>
            {abort.current && (
              <Button variant="ghost" onClick={cancel}>
                생성 중지
              </Button>
            )}
          </div>
        )}
        <div className="studio-create-setup">
          <StudioSourcePicker
            sources={sources}
            sourceId={sourceId}
            profile={profile}
            busy={!!busy}
            onSource={choose}
            onFile={upload}
            onSample={sample}
            onRefresh={() => {
              if (sourceId) choose(sourceId);
            }}
          />
          <section className="studio-create-request" aria-labelledby="studio-request-heading">
            <span className="studio-eyebrow">02 · 만들고 싶은 분석</span>
            <h2 id="studio-request-heading">어떤 내용을 보고 싶으세요?</h2>
            <p>총매출과 환불액, 날짜별 추세처럼 필요한 내용을 자연스럽게 적어 주세요.</p>
            {metrics.length > 0 && (
              <fieldset className="studio-create-metrics">
                <legend>재사용할 저장 지표 · 선택 사항</legend>
                <div className="studio-create-metric-options">
                  {metrics.map(metric => (
                    <Label key={metric.id} className="flex items-start gap-2 py-2">
                      <Checkbox
                        disabled={!!busy}
                        checked={selectedMetrics.includes(metric.id)}
                        onCheckedChange={checked => {
                          invalidate();
                          setSelectedMetrics(current =>
                            checked === true ? [...current, metric.id] : current.filter(id => id !== metric.id),
                          );
                        }}
                      />
                      <span>{metric.label + ' · v' + metric.definitionVersion}</span>
                    </Label>
                  ))}
                </div>
              </fieldset>
            )}
            <TextField
              label="만들 대시보드 요청"
              multiline
              minRows={5}
              value={prompt}
              onChange={event => {
                invalidate();
                setPrompt(event.target.value);
                setNotice('');
              }}
              disabled={!!busy}
              inputProps={{ maxLength: 2000 }}
              placeholder="예: 총 요청 수와 평균 입찰 하한, 기기별 요청 수와 일별 추세를 보여 줘"
            />
            <div className="studio-create-request-actions">
              <span>Codex · gpt-6-luna 요청</span>
              <Button variant="default" disabled={!!busy || !profile || !prompt.trim()} onClick={generate}>
                지표와 차트 제안
              </Button>
            </div>
            <p className="studio-create-note">서버에 저장한 단일 소스 · 최대 6개 블록 · 아직 저장·공유되지 않습니다.</p>
          </section>
        </div>
        {!!proposal?.clarifications?.length && (
          <section className="studio-create-clarify" aria-labelledby="studio-clarify-heading">
            <h2 id="studio-clarify-heading">계산 전에 확인해 주세요</h2>
            <p>분모를 추측해 계산하지 않습니다. 선택 후 같은 요청을 다시 검증합니다.</p>
            {proposal.clarifications.map(question => (
              <div className="studio-create-question" key={question.id}>
                <p>{question.question}</p>
                {question.choices.length ? (
                  <TextField
                    select
                    label="환불률 분모"
                    value={answers[question.id] ?? ''}
                    onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}
                    disabled={!!busy}
                  >
                    <option value="" disabled>
                      의미를 선택하세요
                    </option>
                    {question.choices.map(choice => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </TextField>
                ) : (
                  <Alert severity="warning">
                    필수 열이 있는 파일을 선택하거나 요청을 수정해 주세요. 계산과 저장은 실행되지 않았습니다.
                  </Alert>
                )}
              </div>
            ))}
            {proposal.clarifications.every(question => question.choices.length > 0) && (
              <Button
                variant="default"
                disabled={!!busy || proposal.clarifications.some(question => !answers[question.id])}
                onClick={generate}
              >
                의미 확인 후 다시 제안
              </Button>
            )}
          </section>
        )}
        {proposal?.preview && (
          <>
            <StudioSemanticReview proposal={proposal} />
            <div className="studio-create-save">
              <p>확인한 지표와 차트를 비공개 대시보드로 저장합니다. 다음 화면에서 배치·표현·AI 수정을 이어가세요.</p>
              <Button variant="default" disabled={!!busy} onClick={save}>
                Studio에 저장하고 열기
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
