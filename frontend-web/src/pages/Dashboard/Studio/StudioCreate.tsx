import AnalysisBasis from '@/components/analysis/AnalysisBasis';
import { BusinessBasisResult, fetchBusinessBasis } from '@/api/businessBasis';
import BusinessBasisDetails from '../../Explore/BusinessBasisDetails';
import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';
import React, { useEffect, useRef, useState } from 'react';
import IconLogo from '@/assets/images/logo.svg?react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import StudioMetricPicker from './StudioMetricPicker';
import AiUsageChip from './AiUsageChip';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
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
  validateCreationProposal,
} from './studioCreation';
import StudioSourcePicker from './StudioSourcePicker';
import { StudioSampleId } from './studioDemoSamples';
import StudioSemanticReview from './StudioSemanticReview';
import StudioProposalRefinement from './StudioProposalRefinement';
import {
  CreationConfirmation,
  CreationSaveRequest,
  creationConfirmationKey,
  readCreationConfirmation,
  writeCreationConfirmation,
  removeCreationConfirmation,
} from './studioCreationRecovery';
import {
  CreationQuestion,
  creationQuestionKey,
  readCreationQuestion,
  writeCreationQuestion,
  removeCreationQuestion,
} from './studioCreationQuestion';
import './studio.css';
import { useAiLabel, useAiNote } from '@/hooks/useAiStatus';
export default function StudioCreate() {
  const { listHref, link: artifactLink } = artifactListNavigation(useLocation());
  const session = useRef(editorDraftSessionEpoch());
  const currentSession = () => editorDraftSessionEpoch() === session.current;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sources, setSources] = useState<StudioSource[]>([]),
    [sourceId, setSourceId] = useState<number | null>(null),
    [profile, setProfile] = useState<SourceProfile | null>(null);
  const [basis, setBasis] = useState<BusinessBasisResult | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]),
    [selectedMetrics, setSelectedMetrics] = useState<number[]>([]);
  const aiLabel = useAiLabel();
  const aiNote = useAiNote();
  const [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<CreationProposal | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const [refining, setRefining] = useState(false),
    [saveUncertain, setSaveUncertain] = useState(false);
  const [recovery, setRecovery] = useState<CreationConfirmation | null>(null);
  const confirmationKey = useRef<string | null>(null);
  const questionKey = useRef<string | null>(null),
    questionDirty = useRef(false);
  const [questionRecovery, setQuestionRecovery] = useState<CreationQuestion | null>(null);
  const [questionStorageError, setQuestionStorageError] = useState(false);
  const markQuestionEdited = () => {
    questionDirty.current = true;
    setQuestionRecovery(null);
  };
  const attempt = useRef<CreationConfirmation | null>(null);
  const [unavailableRecovery, setUnavailableRecovery] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [canRepropose, setCanRepropose] = useState(false);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const locked = initializationFailed || restoring || !!busy || refining || saveUncertain || !!recovery;
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const suggestions = [
    {
      label: '고객별 매출·비용',
      columns: ['revenue', 'cost', 'profit'],
      dimension: 'company',
      prompt:
        '총매출 SUM(revenue), 총비용 SUM(cost), profit 열 기준 이익 SUM(profit)을 각각 숫자 지표로, company별 이익을 막대 차트로 보여 줘. 금액은 소수점 둘째 자리까지 표시하고 통화를 추측하지 말아 줘.',
    },
    {
      label: '마진과 이익 추세',
      columns: ['profit', 'revenue'],
      date: 'day',
      prompt:
        '전체 마진을 SUM(profit) / SUM(revenue) * 100인 백분율 숫자 지표로 보여 줘. day별 이익 SUM(profit) 추세를 소수점 둘째 자리로 보여 줘. 통화는 추측하지 말고 0매출 분모는 빈 값으로 유지해 줘.',
    },
    {
      label: '앱 단계별 전환',
      columns: ['visits', 'downloads', 'signups'],
      prompt:
        '전체 방문 수 SUM(visits), 다운로드 수 SUM(downloads), 가입 수 SUM(signups)를 숫자 지표로 보여 줘. 다운로드 전환율은 SUM(downloads) / SUM(visits) * 100, 가입 전환율은 SUM(signups) / SUM(downloads) * 100인 백분율 지표로 보여 줘.',
    },
    {
      label: '버전별 다운로드',
      columns: ['visits', 'downloads'],
      dimension: 'version',
      prompt:
        'version별 다운로드 수 SUM(downloads)를 막대 차트로 보여 줘. 전체 다운로드 전환율 SUM(downloads) / SUM(visits) * 100을 백분율 숫자 지표로 추가해 줘.',
    },
    {
      label: '매출·환불 요약',
      columns: ['revenue', 'refund_amount', 'net_amount'],
      prompt: '결제 성공액, 환불액, 차감 수취액을 각각 숫자 지표로 보여 줘.',
    },
    {
      label: '주문일별 결제 추세',
      columns: ['revenue'],
      date: 'ordered_at',
      prompt: '주문일별 결제 성공액 추세를 보여 줘.',
    },
    {
      label: '주문 기준 환불률',
      columns: ['paid_orders', 'refunded_orders'],
      prompt: '결제 완료 주문 수와 환불 주문 수, 주문 수 기준 환불률을 숫자 지표로 보여 줘.',
    },
  ].filter(
    suggestion =>
      profile?.supported &&
      profile.rowCount !== '0' &&
      suggestion.columns.every(name =>
        profile.columns.some(column => column.name === name && column.numeric && column.nullCount !== profile.rowCount),
      ) &&
      (!suggestion.dimension ||
        profile.columns.some(column => column.name === suggestion.dimension && column.nullCount !== profile.rowCount)) &&
      (!suggestion.date ||
        profile.columns.some(
          column => column.name === suggestion.date && column.temporal && column.nullCount !== profile.rowCount,
        )),
  );
  const hasAuctionColumns =
    profile?.supported &&
    profile.rowCount !== '0' &&
    ['bid_request_cnt', 'bid_floor', 'has_bid_floor_cnt'].every(name =>
      profile.columns.some(column => column.name === name && column.numeric && column.nullCount !== profile.rowCount),
    );
  const promptExample = suggestions[0]
    ? '예: ' + suggestions[0].prompt
    : hasAuctionColumns
    ? '예: 총 요청 수와 평균 입찰 하한을 보여 줘.'
    : '예: 이 데이터에서 확인하고 싶은 지표를 적어 주세요.';
  const epoch = useRef(0),
    mounted = useRef(true),
    pending = useRef(false),
    abort = useRef<AbortController | null>(null);
  const creation = useRef<CreationSaveRequest | null>(null);
  const invalidate = () => {
    epoch.current += 1;
    abort.current?.abort();
    abort.current = null;
    setProposal(null);
    setAnswers({});
    setRefining(false);
    creation.current = null;
    attempt.current = null;
  };
  const choose = async (id: number, remember = true) => {
    if (remember && prompt.trim()) markQuestionEdited();
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
      const [p, m, business] = await Promise.all([
        get('/bi/sources/' + id + '/profile'),
        get('/bi/metrics', { sourceId: id }),
        fetchBusinessBasis(id),
      ]);
      if (!mounted.current || !currentSession() || generation !== epoch.current) return;
      const data = creationData(p);
      if (!data?.supported || data.sourceId !== id || !Array.isArray(data.columns)) throw new Error('unsupported');
      // UC040: a verified new source does not depend on a second index read.
      setSources(rows =>
        rows.some(row => row.id === id) ? rows : [...rows, { id, name: data.name ?? '데이터 #' + id, engine: 'duckdb' }],
      );
      setBasis(business);
      setProfile({
        ...data,
        columns: business.businessColumns.map(c => ({ ...data.columns.find(n => n.name === c.name), ...c })),
      });
      setMetrics(creationData(m));
      return true;
    } catch (cause) {
      if (mounted.current && currentSession() && generation === epoch.current) setError(creationError(cause));
      return false;
    } finally {
      if (mounted.current && currentSession() && generation === epoch.current) setBusy('');
    }
  };
  useEffect(() => {
    mounted.current = true;
    const initialEpoch = epoch.current;
    let current = true;
    fetchStudioSources()
      .then(async rows => {
        if (!mounted.current || epoch.current !== initialEpoch) return;
        setSources(rows);
        const key = await creationConfirmationKey();
        if (!mounted.current || epoch.current !== initialEpoch) return;
        confirmationKey.current = key;
        questionKey.current = creationQuestionKey(key);
        const stored = readCreationConfirmation(key);
        if (stored && rows.some(row => row.id === stored.sourceId && row.engine === 'duckdb')) {
          attempt.current = stored;
          creation.current = stored.request;
          setRecovery(stored);
          setSourceId(stored.sourceId);
          setPrompt(stored.prompt);
          setSaveUncertain(true);
          return;
        }
        if (stored) {
          setUnavailableRecovery(true);
          setSaveUncertain(true);
          return;
        }
        const initial = Number(params.get('sourceId'));
        if (initial > 0 && rows.some(row => row.id === initial && row.engine === 'duckdb')) {
          await choose(initial, false);
          const parentId = params.get('proposalId');
          if (parentId && mounted.current) {
            const generation = epoch.current;
            try {
              const response = await get('/studio/proposals/' + encodeURIComponent(parentId), { sourceId: initial });
              if (mounted.current && currentSession() && generation === epoch.current) {
                const restored = validateCreationProposal(creationData(response), initial);
                setProposal(restored);
                if (typeof restored.requestPrompt === 'string') setPrompt(restored.requestPrompt);
              }
            } catch {
              if (mounted.current && currentSession() && generation === epoch.current)
                setError('생성안이 만료됐거나 불러올 수 없습니다. 이 소스로 새 생성 요청을 보내 주세요.');
            }
          }
        } else if (!params.get('sourceId') && !params.get('proposalId')) {
          setQuestionRecovery(readCreationQuestion(questionKey.current));
        }
      })
      .catch(() => {
        if (mounted.current && epoch.current === initialEpoch) {
          setInitializationFailed(true);
          setError('저장 확인 정보를 불러오지 못했습니다. 보관 기록은 유지됩니다. 연결을 확인한 뒤 다시 불러와 주세요.');
        }
      })
      .finally(() => {
        if (mounted.current && current) setRestoring(false);
      });
    return () => {
      current = false;
      mounted.current = false;
      epoch.current += 1;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (restoring || !questionDirty.current || recovery || unavailableRecovery || saveUncertain) return;
    setQuestionStorageError(!writeCreationQuestion(questionKey.current, { sourceId, prompt }));
  }, [prompt, sourceId, restoring, recovery, unavailableRecovery, saveUncertain]);
  const restoreQuestion = async (useSelectedSource = false) => {
    if (!questionRecovery || locked || prompt.trim()) return;
    const record = questionRecovery;
    // UC048 A3: replacing the source requires a separate explicit action and a fresh access check.
    if (useSelectedSource && (!profile?.supported || profile.sourceId !== sourceId || sourceId === record.sourceId)) return;
    const targetSource = useSelectedSource ? sourceId : record.sourceId;
    if (targetSource !== null && !(await choose(targetSource, false))) return;
    if (!mounted.current || !currentSession()) return;
    markQuestionEdited();
    setPrompt(record.prompt);
  };
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
      if (!mounted.current || !currentSession() || generation !== epoch.current) return;
      await choose(id);
    } catch (cause) {
      if (mounted.current && currentSession() && generation === epoch.current) setError(creationError(cause, context));
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
  const sample = (sample: StudioSampleId) =>
    prepareSource(async () => {
      const data = creationData(await post('/studio/samples', { sample }, { timeout: 360000 }));
      if (!Number.isSafeInteger(data?.sourceId)) throw new Error('invalid sample');
      return data.sourceId;
    }, '샘플을 서버에 준비하는 중입니다…');
  const generate = async (adoptLatest = false) => {
    if (pending.current || locked || !sourceId || !profile || !prompt.trim() || !currentSession()) return;
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
    // A failed/slow refresh must not discard the existing complete preview.
    creation.current = null;
    attempt.current = null;
    try {
      const next = await proposeStudio(
        {
          sourceId,
          prompt: prompt.trim(),
          ...(!adoptLatest && selectedMetrics.length ? { selectedMetricIds: selectedMetrics } : {}),
          ...(Object.keys(answers).length ? { clarificationAnswers: answers } : {}),
          ...(old ? { expectedSourceRevision: old.sourceRevision } : {}),
          ...(adoptLatest && old
            ? { parentProposalId: old.proposalId, targetBlockIndex: 0, adoptLatestBusinessBasis: true }
            : {}),
        },
        controller.signal,
      );
      if (!mounted.current || !currentSession() || generation !== epoch.current || controller.signal.aborted) return;
      setProposal(next);
      setNotice(
        next.clarifications?.length
          ? '계산 전에 업무 의미 확인이 필요합니다.'
          : '계산 결과가 준비됐습니다. 지표 정의를 확인한 뒤 저장하세요.',
      );
    } catch (cause) {
      if (mounted.current && currentSession() && generation === epoch.current && !controller.signal.aborted)
        setError(creationError(cause));
    } finally {
      if (mounted.current && currentSession() && generation === epoch.current) {
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
  const discardConfirmation = () => {
    try {
      removeCreationConfirmation(confirmationKey.current);
      setRecovery(null);
      setUnavailableRecovery(false);
      attempt.current = null;
      setSaveUncertain(false);
      creation.current = null;
      setSourceId(null);
      setPrompt('');
      setError('');
      setNotice('이 탭의 확인 기록을 지웠습니다. 이미 저장된 대시보드는 유지됩니다.');
    } catch {
      setError('확인 기록을 지우지 못했습니다. 기록과 요청은 유지됩니다.');
    }
  };
  const prepareReproposal = async () => {
    if (pending.current || busy || !canRepropose || !recovery) return;
    try {
      const key = await creationConfirmationKey();
      if (!mounted.current || key !== confirmationKey.current) throw new Error('scope changed');
      removeCreationConfirmation(key);
      const id = recovery.sourceId;
      setRecovery(null);
      setSaveUncertain(false);
      setCanRepropose(false);
      await choose(id);
      if (mounted.current) setNotice('질문을 유지했습니다. 새 제안을 요청하고 미리보기를 확인한 뒤 저장하세요.');
    } catch {
      if (mounted.current) setError('로그인 범위나 확인 기록을 확인하지 못했습니다. 기존 기록을 유지합니다.');
    }
  };
  const save = async () => {
    if (
      !currentSession() ||
      pending.current ||
      refining ||
      (!recovery && (!proposal?.preview || proposal.clarifications?.length))
    )
      return;
    pending.current = true;
    setBusy('Studio에 저장하는 중입니다…');
    setError('');
    setCanRepropose(false);
    let sent = false;
    try {
      const key = await creationConfirmationKey();
      if (!mounted.current || !currentSession()) return;
      if (confirmationKey.current && key !== confirmationKey.current) throw new Error('confirmation scope changed');
      if (!creation.current && proposal)
        creation.current = {
          requestId: studioRequestId(),
          proposalId: proposal.proposalId,
          expectedSourceRevision: proposal.sourceRevision,
        };
      if (!creation.current || !sourceId) throw new Error('missing confirmation');
      // UC-032: persist before sending; never renew the original recovery deadline on retries.
      attempt.current ??= {
        version: 1,
        updatedAt: Date.now(),
        sourceId,
        title: proposal?.title ?? '',
        prompt,
        request: creation.current,
      };
      writeCreationConfirmation(key, attempt.current);
      confirmationKey.current = key;
      sent = true;
      const data = creationData(await post('/studio/dashboards', creation.current, { timeout: 180000 }));
      if (!Number.isSafeInteger(data?.dashboardId) || data.dashboardId <= 0) throw new Error('invalid create');
      if (mounted.current && currentSession()) {
        removeCreationConfirmation(key);
        const savedQuestion = readCreationQuestion(questionKey.current);
        if (questionDirty.current || (savedQuestion?.sourceId === sourceId && savedQuestion.prompt === prompt))
          removeCreationQuestion(questionKey.current);
        questionDirty.current = false;
        setSaveUncertain(false);
        navigate(artifactLink('/dashboard/' + data.dashboardId + '/studio'));
      }
    } catch (cause) {
      if (mounted.current) {
        if (!sent) {
          setError(
            '저장 확인 기록을 보관할 수 없거나 로그인 범위가 바뀌었습니다. 저장 요청을 보내지 않았습니다. 입력과 기존 기록은 유지됩니다.',
          );
        } else {
          const status = Number((cause as any)?.response?.status);
          const uncertain = !status || status >= 500;
          const unavailable =
            status === 400 && (cause as any)?.response?.data?.data?.code === 'STUDIO_CREATION_REPROPOSE_REQUIRED';
          setCanRepropose(unavailable);
          setSaveUncertain(uncertain);
          if (!uncertain) {
            setRecovery(attempt.current);
            setSaveUncertain(true);
          }
          setError(
            uncertain
              ? '저장 완료 여부를 확인하지 못했습니다. 같은 저장 요청을 다시 확인해 주세요. 결과 확인 전에는 생성안을 변경하지 않습니다.'
              : unavailable
              ? '저장된 결과가 없고 이전 생성안을 사용할 수 없습니다. 질문을 유지하고 새 제안을 준비할 수 있습니다.'
              : creationError(cause),
          );
        }
      }
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
        <Link to={listHref} className="studio-create-brand" aria-label="VanillaMeta">
          <IconLogo aria-hidden="true" />
        </Link>
        <div>
          <span className="studio-eyebrow">DASHBOARD STUDIO</span>
          <h1>내 데이터로 시작하기</h1>
        </div>
        <AiUsageChip />
        <Button variant="outline" asChild>
          <Link to={listHref}>아티팩트 목록</Link>
        </Button>
      </header>
      <main id="studio-create-main" className="studio-create-main">
        <AnalysisBasis
          className="mb-5"
          status={proposal?.preview ? '생성안 · 저장 전' : profile ? '데이터 연결됨 · 생성 전' : '시작 · 데이터 선택 전'}
          data={profile ? `${profile.name || '데이터 소스'} · #${profile.sourceId}` : '데이터를 선택하세요'}
          period="전체 기간 · UTC"
          filters="공통 필터 없음"
          metrics={
            proposal?.semanticProposal.length
              ? proposal.semanticProposal
                  .map(
                    item =>
                      `${item.metric.label || item.title}${item.metric.unit ? ' · ' + item.metric.unit : ''}${
                        item.metric.id ? ' · v' + item.metric.definitionVersion : ' · 새 지표'
                      }`,
                  )
                  .join(' / ')
              : selectedMetrics.length
              ? `저장 지표 ${selectedMetrics.length}개 선택 · 생성안 확인 전`
              : '질문 후 제안 · 아직 확정되지 않음'
          }
          note="데이터를 연결하고 지표를 확인한 뒤 저장하세요. 다른 화면의 기간·필터를 자동으로 가져오지 않습니다."
        />
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
        {initializationFailed && (
          <div className="studio-create-source-actions">
            <Button variant="outline" onClick={() => window.location.reload()}>
              저장 확인 상태 다시 불러오기
            </Button>
          </div>
        )}
        {questionRecovery && !restoring && !recovery && !unavailableRecovery && (
          <Alert severity="info" className="studio-create-alert">
            <p>
              이 탭에 보관한 새 생성 질문이 있습니다. 최대 24시간 보관하며, 복구해도 AI 요청이나 저장은 실행하지 않습니다.
            </p>
            {questionRecovery.sourceId !== null &&
              !sources.some(row => row.id === questionRecovery.sourceId && row.engine === 'duckdb') && (
                <p>보관 질문의 데이터에 접근할 수 없습니다. 권한을 확인하거나 이 기록만 폐기해 주세요.</p>
              )}
            <div className="studio-create-source-actions">
              <Button
                size="sm"
                disabled={
                  locked ||
                  !!prompt.trim() ||
                  (questionRecovery.sourceId !== null &&
                    !sources.some(row => row.id === questionRecovery.sourceId && row.engine === 'duckdb'))
                }
                onClick={() => restoreQuestion()}
              >
                새 생성 질문 복구
              </Button>
              {profile?.supported && profile.sourceId === sourceId && sourceId !== questionRecovery.sourceId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked || !!prompt.trim()}
                  onClick={() => restoreQuestion(true)}
                >
                  선택한 데이터로 질문 복구
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => {
                  if (removeCreationQuestion(questionKey.current)) setQuestionRecovery(null);
                  else setQuestionStorageError(true);
                }}
              >
                보관 생성 질문 폐기
              </Button>
            </div>
            <p>
              다른 데이터를 아래에서 선택한 뒤 질문만 복구할 수도 있습니다. 소스 구조는 다시 확인하며, 저장 지표 선택과 이전
              제안·미리보기는 복구하지 않습니다.
            </p>
          </Alert>
        )}
        {questionStorageError && (
          <Alert severity="info" className="studio-create-alert">
            질문을 이 탭에 보관하지 못했습니다. 새로고침하면 입력이 사라질 수 있으며 현재 질문은 계속 사용할 수 있습니다.
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
        {(recovery || unavailableRecovery) && (
          <section className="studio-create-request" aria-labelledby="studio-confirmation-heading">
            <span className="studio-eyebrow">저장 확인 대기</span>
            <h2 id="studio-confirmation-heading">저장 요청과 질문을 복구했습니다</h2>
            <p>
              {recovery
                ? recovery.title
                : '저장 확인 기록의 데이터 소스에 접근할 수 없습니다. 권한을 확인하거나 이 탭의 기록만 지울 수 있습니다.'}
            </p>
            <p className="whitespace-pre-wrap break-words">{recovery?.prompt}</p>
            <Alert severity="info">
              같은 로그인·이 탭에 최대 24시간 보관합니다. 미리보기는 보관하지 않으며 저장·AI 요청을 자동 실행하지 않습니다.
              기록을 지워도 이미 저장된 대시보드는 유지됩니다.
            </Alert>
            <div className="studio-create-source-actions">
              {recovery && (
                <Button disabled={!!busy} onClick={save}>
                  같은 저장 요청 확인
                </Button>
              )}
              {canRepropose && recovery && (
                <Button variant="outline" disabled={!!busy} onClick={prepareReproposal}>
                  질문을 유지하고 새 제안 준비
                </Button>
              )}
              <Button variant="outline" disabled={!!busy} onClick={discardConfirmation}>
                확인 대기 기록 지우기
              </Button>
            </div>
          </section>
        )}
        {!recovery && !unavailableRecovery && (
          <>
            <div className="studio-create-setup">
              <StudioSourcePicker
                sources={sources}
                sourceId={sourceId}
                profile={profile}
                busy={locked}
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
                {basis && <BusinessBasisDetails basis={basis.businessBasis} />}
                {metrics.length > 0 && (
                  <StudioMetricPicker
                    key={sourceId}
                    metrics={metrics}
                    selected={selectedMetrics}
                    busy={locked}
                    onChange={(id, checked) => {
                      invalidate();
                      setSelectedMetrics(current =>
                        checked ? Array.from(new Set([...current, id])) : current.filter(value => value !== id),
                      );
                    }}
                  />
                )}
                {suggestions.length > 0 && (
                  <div className="studio-create-suggestions" role="group" aria-label="추천 질문">
                    <span className="studio-create-note">추천 질문 · 입력 후 자유롭게 바꿀 수 있어요</span>
                    <div className="studio-create-suggestion-actions">
                      {suggestions.map(suggestion => (
                        <Button
                          key={suggestion.label}
                          variant="outline"
                          disabled={locked || !!proposal}
                          onClick={() => {
                            invalidate();
                            markQuestionEdited();
                            setPrompt(suggestion.prompt);
                            setError('');
                            setNotice('');
                            promptInput.current?.focus();
                          }}
                        >
                          {suggestion.label}
                        </Button>
                      ))}
                    </div>
                    {proposal && (
                      <span className="studio-create-note">생성안이 있을 때는 입력창에서 질문을 직접 수정해 주세요.</span>
                    )}
                  </div>
                )}
                <TextField
                  label="만들 대시보드 요청"
                  inputRef={promptInput}
                  multiline
                  minRows={5}
                  value={prompt}
                  onChange={event => {
                    invalidate();
                    markQuestionEdited();
                    setPrompt(event.target.value);
                    setNotice('');
                  }}
                  disabled={locked}
                  inputProps={{ maxLength: 2000 }}
                  placeholder={promptExample}
                />
                <div className="studio-create-request-actions">
                  <span>
                    {aiLabel} 요청{aiNote}
                  </span>
                  <Button variant="default" disabled={locked || !profile || !prompt.trim()} onClick={() => generate()}>
                    지표와 차트 제안
                  </Button>
                </div>
                <p className="studio-create-note">서버에 저장한 단일 소스 · 최대 6개 블록 · 아직 저장·공유되지 않습니다.</p>
              </section>
            </div>
            {!!proposal?.clarifications?.length && (
              <section className="studio-create-clarify" aria-labelledby="studio-clarify-heading">
                <h2 id="studio-clarify-heading">계산 전에 확인해 주세요</h2>
                <p>
                  {proposal.clarifications.some(question => question.id === 'refundDenominator')
                    ? '분모를 추측해 계산하지 않습니다. 선택 후 같은 요청을 다시 검증합니다.'
                    : proposal.clarifications.every(question => question.id === 'unsupportedRequest')
                    ? '지원하지 않는 계산이라 다른 계산으로 대신하지 않습니다. 계산과 저장은 실행되지 않았습니다.'
                    : '필요한 데이터를 먼저 확인합니다. 없는 열이나 업무 수치를 다른 지표로 대체하지 않습니다.'}
                </p>
                {proposal.clarifications.map(question => (
                  <div className="studio-create-question" key={question.id}>
                    <p>{question.question}</p>
                    {question.id === 'unsupportedRequest' ? null : question.choices.length ? (
                      <TextField
                        select
                        label="환불률 분모"
                        value={answers[question.id] ?? ''}
                        onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}
                        disabled={locked}
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
                    disabled={locked || proposal.clarifications.some(question => !answers[question.id])}
                    onClick={() => generate()}
                  >
                    의미 확인 후 다시 제안
                  </Button>
                )}
              </section>
            )}
            {proposal?.preview && (
              <>
                <StudioSemanticReview proposal={proposal} />
                <Button variant="outline" disabled={locked || !prompt.trim()} onClick={() => generate(true)}>
                  최신 업무 기준으로 다시 제안
                </Button>
                <StudioProposalRefinement
                  proposal={proposal}
                  disabled={!!busy || saveUncertain}
                  onBusy={setRefining}
                  onProposal={next => {
                    setProposal(next);
                    creation.current = null;
                    attempt.current = null;
                    setNotice('');
                  }}
                />
                <div className="studio-create-save">
                  <p>확인한 지표와 차트를 비공개 대시보드로 저장합니다. 다음 화면에서 배치·표현·AI 수정을 이어가세요.</p>
                  <Button variant="default" disabled={!!busy || refining} onClick={save}>
                    {saveUncertain ? '같은 저장 요청 확인' : 'Studio에 저장하고 열기'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
