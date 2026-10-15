import React, { useEffect, useRef, useState } from 'react';
import StudioConversationCreation from './StudioConversationCreation';
import { StudioRemixFlow } from './StudioRemix';
import type { RemixSaveInput } from './studioRemixApi';
import { Alert, Button } from '@mui/material';
import {
  StudioExecution,
  STEP_LABELS,
  STATUS_LABELS,
  executionSummary,
  retryStep,
  publishedDashboardPath,
  remixHandoff,
} from './studioExecution';
type Props = {
  runs: StudioExecution[];
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onRetry: (run: StudioExecution) => void;
  onCancel: (run: StudioExecution) => void;
  canRetry: (run: StudioExecution) => boolean;
  onCreation?: (run: StudioExecution) => Promise<void>;
  onRemix?: (run: StudioExecution, request: RemixSaveInput, isCurrent: () => boolean) => Promise<void>;
};
/** Mapping uses the same checked workflow as the published remix route. */
function RemixHandoff({ run, onRemix }: Pick<Props, 'onRemix'> & { run: StudioExecution }) {
  const [open, setOpen] = useState(false);
  const receipt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && run.remixSaveResult) receipt.current?.focus();
  }, [open, run.remixSaveResult]);
  const remix = remixHandoff(run);
  if (!remix) return null;
  if (run.remixSaveResult)
    return (
      <div className="studio-remix-receipt" role="status" tabIndex={-1} ref={receipt}>
        <strong>비공개 복제 완료</strong>
        <p>게시본 v{run.remixSaveResult.version} · 내 데이터에 연결한 새 대시보드입니다.</p>
        <Button
          component="a"
          href={'/dashboard/' + run.remixSaveResult.dashboardId + '/studio'}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
        >
          비공개 복제본 열기
        </Button>
        <p className="studio-execution-hint">이 탭의 편집은 유지됩니다. 복제본은 별도 탭에서 열립니다.</p>
      </div>
    );
  return (
    <div className="studio-conversation-remix">
      <p>복제 준비 v{remix.version} · 이 대화에서 내 데이터와 열 매핑을 확인합니다.</p>
      {!open && (
        <Button className="studio-remix-continue" variant="outlined" disabled={!onRemix} onClick={() => setOpen(true)}>
          내 데이터 연결하고 복제 계속
        </Button>
      )}
      <p className="studio-execution-hint">
        계산 결과를 확인한 뒤 비공개 생성을 누르면 별도 복제본으로 저장됩니다. 현재 초안은 유지됩니다.
      </p>
      {open && onRemix && (
        <StudioRemixFlow
          token={remix.token}
          expectedVersion={remix.version}
          embedded
          onSave={(request, isCurrent) => onRemix(run, request, isCurrent)}
        />
      )}
    </div>
  );
}
export default function StudioExecutionActivity({
  runs,
  busy,
  error,
  onRefresh,
  onRetry,
  onCancel,
  canRetry,
  onRemix,
  onCreation,
}: Props) {
  return (
    <section className="studio-execution" aria-labelledby="studio-execution-heading">
      <div className="studio-execution-heading">
        <h3 id="studio-execution-heading">실행 기록</h3>
        <Button onClick={onRefresh} disabled={busy}>
          상태 새로고침
        </Button>
      </div>
      <p className="studio-execution-caption">
        완료 단계는 반복하지 않습니다. 원본 행과 요청 원문은 실행 기록에 저장하지 않습니다.
      </p>
      {error && <Alert severity="error">{error}</Alert>}
      {!runs.length && !error && <p>요청을 보내면 데이터 확인부터 저장·게시까지 진행 상태를 볼 수 있습니다.</p>}
      {runs.slice(0, 5).map((run, index) => (
        <details className="studio-execution-card" key={run.runId} open={index === 0}>
          <summary>
            <span>요청 {runs.length - index}</span>
            <span
              className={
                'studio-execution-badge studio-execution-' + (run.publicationResult?.revokedAt ? 'cancelled' : run.status)
              }
            >
              {run.publicationResult?.revokedAt ? '게시 중지됨' : STATUS_LABELS[run.status]}
            </span>
          </summary>
          <p role={['failed', 'partial', 'interrupted'].includes(run.status) ? 'status' : undefined}>
            {executionSummary(run)}
          </p>
          {run.publicationResult && (
            <div className="studio-publication-receipt">
              <p>
                게시본 v{run.publicationResult.version} ·{' '}
                {run.publicationResult.visibility === 'link' ? '링크가 있는 사용자' : '비공개 · 소유자만'}
              </p>
              <p>
                데이터 기준 시각 ·{' '}
                <time dateTime={run.publicationResult.asOf}>
                  {new Date(run.publicationResult.asOf).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                </time>
              </p>
              {run.publicationResult.expiresAt && (
                <p>
                  링크 만료 ·{' '}
                  <time dateTime={run.publicationResult.expiresAt}>
                    {new Date(run.publicationResult.expiresAt).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                  </time>
                </p>
              )}
              {run.publicationResult.revokedAt ? (
                <p className="studio-execution-hint">
                  게시 중지 시각 ·{' '}
                  <time dateTime={run.publicationResult.revokedAt}>
                    {new Date(run.publicationResult.revokedAt).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                  </time>
                  . 중지된 링크는 다시 활성화되지 않습니다. 공유하려면 새로 게시해 주세요.
                </p>
              ) : (
                <>
                  <Button
                    component="a"
                    href={publishedDashboardPath(run.publicationResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    sx={{ minHeight: 44 }}
                  >
                    게시본 v{run.publicationResult.version} 열기
                  </Button>
                  <p className="studio-execution-hint">현재 만료·중지·접근 권한은 게시본을 열 때 다시 확인합니다.</p>
                </>
              )}
            </div>
          )}
          <RemixHandoff run={run} onRemix={onRemix} />
          {run.creationResult && <StudioConversationCreation run={run} onSave={onCreation} disabled={busy} />}
          <ol aria-label="실행 단계">
            {run.steps.map(step => (
              <li key={step.stepId}>
                <span>{STEP_LABELS[step.stepId]}</span>
                <span className={'studio-step-status studio-execution-' + step.status}>{STATUS_LABELS[step.status]}</span>
              </li>
            ))}
          </ol>
          {run.requiresRequest && retryStep(run) && (
            <p className="studio-execution-hint">
              원래 요청을 아래 입력란에 다시 적어 주세요. 서버에 요청 원문을 보관하지 않아 재시도에 필요합니다. 편집 기준이
              달라졌다면 새 요청으로 시작하세요.
            </p>
          )}
          {retryStep(run) && (
            <Button variant="outlined" disabled={busy || !canRetry(run)} onClick={() => onRetry(run)}>
              {STEP_LABELS[retryStep(run).stepId]} 다시 시도
            </Button>
          )}
          {['pending', 'running'].includes(run.status) && (
            <Button disabled={busy} onClick={() => onCancel(run)}>
              실행 중지
            </Button>
          )}
        </details>
      ))}
    </section>
  );
}
