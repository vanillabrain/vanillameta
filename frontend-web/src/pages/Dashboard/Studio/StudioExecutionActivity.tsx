import React from 'react';
import { Alert, Button } from '@mui/material';
import { StudioExecution, STEP_LABELS, STATUS_LABELS, executionSummary, retryStep } from './studioExecution';
type Props = {
  runs: StudioExecution[];
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onRetry: (run: StudioExecution) => void;
  onCancel: (run: StudioExecution) => void;
  canRetry: (run: StudioExecution) => boolean;
};
export default function StudioExecutionActivity({ runs, busy, error, onRefresh, onRetry, onCancel, canRetry }: Props) {
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
      {!runs.length && !error && <p>요청을 보내면 데이터 확인부터 저장까지 진행 상태를 볼 수 있습니다.</p>}
      {runs.slice(0, 5).map((run, index) => (
        <details className="studio-execution-card" key={run.runId} open={index === 0}>
          <summary>
            <span>요청 {runs.length - index}</span>
            <span className={'studio-execution-badge studio-execution-' + run.status}>{STATUS_LABELS[run.status]}</span>
          </summary>
          <p role={['failed', 'partial', 'interrupted'].includes(run.status) ? 'status' : undefined}>
            {executionSummary(run)}
          </p>
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
