import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { useNavigate } from 'react-router-dom';
import { post } from '@/helpers/apiHelper';
import DatabaseService from '@/api/databaseService';

// Engines that read a local file and never open a socket.
const FILE_ENGINES = ['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HELP_ACTION_PATTERN = /^[a-z][a-z-]{0,31}$/;
const EXPLANATION_MAX = 1000;
const SAMPLE_ERROR =
  '샘플을 준비하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요. 내 파일 연결은 계속 사용할 수 있습니다.';
const HELP_ERROR = 'AI 오류 설명을 가져오지 못했습니다. 위 안내대로 샘플을 다시 시도하거나 내 파일 연결을 이용해 주세요.';

type SampleDiagnostic = { requestId: string };

const plainText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
};

const errorEnvelope = (error: unknown): Record<string, unknown> | undefined => {
  const body = (error as { response?: { data?: unknown } })?.response?.data as Record<string, unknown> | undefined;
  return (body?.data ?? body) as Record<string, unknown> | undefined;
};

// Only a server-validated diagnostic unlocks the opt-in help button, and only its
// requestId is ever sent. Raw errors, responses, messages and rows never reach the help call.
const sampleDiagnostic = (error: unknown): SampleDiagnostic | null => {
  const diagnostic = errorEnvelope(error)?.diagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  const { requestId, errorCode, stage, version, target, dataHealth } = diagnostic as Record<string, unknown>;
  if (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) return null;
  if (errorCode !== 'SAMPLE_UNAVAILABLE' || stage !== 'sample-install' || version !== 1) return null;
  if (target !== 'commerce-sample' || dataHealth !== 'unverified') return null;
  return { requestId };
};

// The explanation is bounded plain text. Server-provided actions are type-checked but never
// used to render controls, URLs or HTML, so no model output can drive navigation or markup.
const sampleHelp = (response: unknown, requestId: string): string | null => {
  const envelope = (response as { data?: { status?: unknown; data?: unknown } })?.data;
  const payload = envelope?.data as Record<string, unknown> | undefined;
  if (envelope?.status !== 'SUCCESS' || !payload || typeof payload !== 'object') return null;
  if (payload.requestId !== requestId || payload.dataHealth !== 'unverified') return null;
  const explanation = plainText(payload.explanation, EXPLANATION_MAX);
  if (!explanation) return null;
  const actions = payload.actions;
  if (!Array.isArray(actions) || actions.length > 8) return null;
  if (!actions.every(action => typeof action === 'string' && HELP_ACTION_PATTERN.test(action))) return null;
  return explanation;
};

export default function GettingStarted({ returning = false }: { returning?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState<SampleDiagnostic | null>(null);
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpError, setHelpError] = useState('');
  const [help, setHelp] = useState<{ requestId: string; explanation: string } | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const helpController = useRef<AbortController | null>(null);
  const helpPending = useRef(false);
  const activeHelpId = useRef<string | null>(null);
  const explainButton = useRef<HTMLButtonElement | null>(null);
  const [databaseConnectable, setDatabaseConnectable] = useState(true);

  // Shown until the server says every connectable type is a local-file engine (the beta default),
  // so the card never points at a connection form that only answers 403.
  useEffect(() => {
    let current = true;
    Promise.resolve()
      .then(() => DatabaseService.selectDatabaseTypeList())
      .then(response => {
        const types = response?.data?.data;
        if (
          current &&
          Array.isArray(types) &&
          types.every(type => FILE_ENGINES.includes(String(type?.engine).toLowerCase()))
        )
          setDatabaseConnectable(false);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      helpPending.current = false;
      activeHelpId.current = null;
      helpController.current?.abort();
      helpController.current = null;
    };
  }, []);

  const openSample = async () => {
    if (pending.current) return;
    pending.current = true;
    generation.current += 1;
    const token = generation.current;
    helpController.current?.abort();
    helpController.current = null;
    helpPending.current = false;
    activeHelpId.current = null;
    setBusy(true);
    setError('');
    setDiagnostic(null);
    setHelp(null);
    setHelpError('');
    setHelpBusy(false);
    try {
      const response = await post('/commerce/sample', {}, { timeout: 300000 });
      if (token !== generation.current || !mounted.current) return;
      const result = response.data;
      if (result.status !== 'SUCCESS' || !Number.isInteger(result.data?.projectId) || result.data.projectId <= 0)
        throw new Error('invalid sample response');
      navigate(`/commerce/${result.data.projectId}?sample=1`);
    } catch (caught: unknown) {
      if (token !== generation.current || !mounted.current) return;
      setDiagnostic(sampleDiagnostic(caught));
      setError(SAMPLE_ERROR);
    } finally {
      if (token === generation.current) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const cancelHelp = () => {
    helpController.current?.abort();
    helpController.current = null;
    activeHelpId.current = null;
    helpPending.current = false;
    setHelpBusy(false);
    setHelpError('AI 오류 설명 요청을 취소했습니다. 다시 요청하거나 샘플을 다시 시도할 수 있습니다.');
    explainButton.current?.focus();
  };

  const explainError = async () => {
    const active = diagnostic;
    if (!active || helpPending.current || help?.requestId === active.requestId) return;
    const requestId = active.requestId;
    const controller = new AbortController();
    helpController.current = controller;
    helpPending.current = true;
    activeHelpId.current = requestId;
    setHelpBusy(true);
    setHelpError('');
    try {
      const response = await post('/commerce/sample-help', { requestId }, { timeout: 60000, signal: controller.signal });
      if (controller.signal.aborted || !mounted.current || activeHelpId.current !== requestId) return;
      const explanation = sampleHelp(response, requestId);
      if (!explanation) throw new Error('invalid help response');
      setHelp({ requestId, explanation });
    } catch {
      if (controller.signal.aborted || !mounted.current || activeHelpId.current !== requestId) return;
      setHelpError(HELP_ERROR);
    } finally {
      if (helpController.current === controller) {
        helpPending.current = false;
        if (mounted.current) setHelpBusy(false);
      }
      if (helpController.current === controller) helpController.current = null;
    }
  };
  return (
    <section aria-labelledby="getting-started-title" className="mb-6">
      <h2 id="getting-started-title" className="mb-2 text-2xl font-bold">
        {returning ? '새로운 분석을 시작해 볼까요?' : '어떤 데이터를 분석해 볼까요?'}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        파일·샘플·저장된 데이터를 고르고 질문으로 차트를 제안받으세요. 계산을 확인하고 수정한 뒤 비공개로 저장합니다.
      </p>
      <Button className="mb-4 self-start" onClick={() => navigate('/studio/new')}>
        질문으로 대시보드 만들기
      </Button>
      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="min-w-0 flex-1">
          <CardHeader className="gap-2">
            <h3 className="text-base leading-snug font-semibold">매출·환불 샘플</h3>
            <p className="text-sm text-muted-foreground">37개 주문의 결제·환불 추이와 채널별 성과를 둘러보세요.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Analytics Engineering 합성 데이터 일부 · CC BY 4.0 · USD/UTC. 실제 고객 매출이 아닙니다.
            </p>
            <Button className="self-start" onClick={openSample} aria-disabled={busy}>
              {busy ? '샘플 준비 중…' : '샘플 대시보드 보기'}
            </Button>
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {busy ? '데이터를 확인하고 저장하고 있습니다. 잠시 기다려 주세요.' : '다시 열면 저장된 샘플을 사용합니다.'}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 flex-1">
          <CardHeader className="gap-2">
            <h3 className="text-base leading-snug font-semibold">내 파일로 시작</h3>
            <p className="text-sm text-muted-foreground">
              매출·환불은 주문·결제·환불 CSV를 준비하세요. 고객 CSV는 선택입니다.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            <Button onClick={() => navigate('/explore')}>SQL 없이 차트 만들기</Button>
            <Button variant="outline" onClick={() => navigate('/commerce?import=1')}>
              매출·환불 파일 연결
            </Button>
            <Button variant="ghost" onClick={() => navigate('/data/file')}>
              일반 CSV·JSON·Parquet 분석
            </Button>
          </CardContent>
        </Card>
        {databaseConnectable && (
          <Card className="min-w-0 flex-1">
            <CardHeader className="gap-2">
              <h3 className="text-base leading-snug font-semibold">데이터베이스 연결</h3>
              <p className="text-sm text-muted-foreground">
                기존 연결 설정과 연결 테스트를 이용합니다. 종류별로 서버·드라이버 설정이 필요합니다.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/data')}>
                데이터 연결 관리
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      {error && (
        <Notice severity="error" className="mt-4 [overflow-wrap:anywhere]">
          {error}
          <div className="mt-2 flex flex-row flex-wrap gap-2">
            <Button variant="ghost" onClick={openSample} aria-disabled={busy}>
              샘플 다시 시도
            </Button>
            <Button variant="ghost" onClick={() => navigate('/commerce?import=1')}>
              내 파일 연결로 이동
            </Button>
            {diagnostic && (
              <Button ref={explainButton} variant="ghost" onClick={explainError} aria-disabled={helpBusy}>
                {helpBusy ? '오류 설명 준비 중…' : 'AI로 오류 설명 보기'}
              </Button>
            )}
            {helpBusy && (
              <Button variant="ghost" onClick={cancelHelp}>
                오류 설명 취소
              </Button>
            )}
          </div>
          {helpError && (
            <p role="status" className="mt-2 text-sm">
              {helpError}
            </p>
          )}
          {diagnostic && help?.requestId === diagnostic.requestId && (
            <div className="mt-2">
              <p className="text-sm font-medium">가능한 원인</p>
              <p role="status" aria-live="polite" className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {help.explanation}
              </p>
              <p className="text-xs text-muted-foreground">복구 상태: 확인되지 않음 (unverified)</p>
            </div>
          )}
        </Notice>
      )}
      <p className="mt-4 text-xs text-muted-foreground">데이터 연결 → Explore 탐색 → Studio 편집 → 게시·복제</p>
    </section>
  );
}
