import React from 'react';
import { Alert, Button, Drawer, TextField, useMediaQuery } from '@mui/material';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import './studio.css';

export type StudioDesignStage = 'start' | 'result' | 'settings' | 'publish';
export type StudioDesignDocument = { title: string; source: string; period: string; blockTitle: string };
/** Product route context: real save state and real source labels. The design preview leaves it undefined. */
export type StudioProductContext = {
  source: string;
  sourceMeta: string;
  period: string;
  blockCount: number;
  canvasTitle: string;
  canvasDescription: string;
  dataLabel: string;
  notice: string;
  save: { label: string; disabled: boolean; pending: boolean; status: string; onSave: () => void };
  banner?: React.ReactNode;
  aiBlockSummary: string;
  aiNote: string;
};
type Props = {
  document: StudioDesignDocument;
  stage: StudioDesignStage;
  panel: 'ai' | 'settings' | null;
  status: 'ready' | 'loading' | 'error';
  onStatusChange: (status: 'ready' | 'loading' | 'error') => void;
  onStageChange: (stage: StudioDesignStage) => void;
  onPanelChange: (panel: 'ai' | 'settings' | null) => void;
  canvas: React.ReactNode;
  inspector: React.ReactNode;
  editToolbar: React.ReactNode;
  history: { canUndo: boolean; canRedo: boolean; count: number; onUndo: () => void; onRedo: () => void };
  product?: StudioProductContext;
  conversation?: React.ReactNode;
};
export default function StudioShell({
  document: doc,
  stage,
  panel,
  onStageChange,
  onPanelChange,
  canvas,
  inspector,
  editToolbar,
  history,
  status,
  onStatusChange,
  product,
  conversation,
}: Props) {
  const start = !product && stage === 'start';
  const compact = useMediaQuery('(max-width:899px)');
  const panelContent = (
    <aside className="studio-panel" aria-label="Studio 보조 패널">
      <div className="studio-panel-tabs" role="group" aria-label="패널 선택">
        <Button aria-pressed={panel === 'ai'} onClick={() => onPanelChange('ai')} startIcon={<AutoAwesomeOutlined />}>
          AI
        </Button>
        <Button aria-pressed={panel === 'settings'} onClick={() => onPanelChange('settings')} startIcon={<TuneOutlined />}>
          블록 설정
        </Button>
        <Button className="studio-panel-close" aria-label="보조 패널 닫기" onClick={() => onPanelChange(null)}>
          <CloseOutlined fontSize="small" />
        </Button>
      </div>
      {panel === 'ai'
        ? conversation ?? (
            <div className="studio-ai">
              <div className="studio-ai-content">
                <span className="studio-ai-avatar">
                  <AutoAwesomeOutlined fontSize="small" />
                </span>
                <h2>함께 다듬어 보세요</h2>
                <p>
                  데이터와 현재 대시보드를 바탕으로
                  <br />
                  원하는 변경을 요청할 수 있습니다.
                </p>
                <div className="studio-context-card">
                  <span className="studio-eyebrow">현재 문맥</span>
                  <strong>{product ? product.source : doc.source}</strong>
                  <span>{product ? product.aiBlockSummary : '총매출 · 환불액 · 순매출'}</span>
                  <span>{product ? product.period : doc.period + ' · 모든 채널'}</span>
                </div>
                <div className="studio-suggestion">“환불액이 큰 채널을 보여 줘”</div>
                <div className="studio-suggestion">“이 차트를 주간으로 바꿔 줘”</div>
                <p className="studio-panel-note">
                  {product ? (
                    product.aiNote
                  ) : (
                    <>
                      AI 연결 전의 배치 시안입니다.
                      <br />
                      실제 요청은 전송되지 않습니다.
                    </>
                  )}
                </p>
              </div>
              <div className="studio-ai-composer">
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="AI에게 요청할 내용"
                  placeholder="변경하고 싶은 내용을 입력하세요"
                />
                <div>
                  <span>{product ? 'AI 수정은 다음 단계에서 연결됩니다' : '시안 · 전송 불가'}</span>
                  <Button disabled variant="contained">
                    전송
                  </Button>
                </div>
              </div>
            </div>
          )
        : inspector}
    </aside>
  );
  return (
    <div
      className="vm-studio"
      onKeyDown={e => {
        if (e.key === 'Escape') onPanelChange(null);
      }}
    >
      <a className="studio-skip" href="#studio-main">
        캔버스로 건너뛰기
      </a>
      <div className="studio-notice">
        <span className="studio-dot" />
        {product ? (
          product.notice
        ) : (
          <>
            로컬 편집 미리보기 <span>가상 데이터 · AI·저장·게시 연결 전</span>
          </>
        )}
      </div>
      <header className="studio-header">
        <div className="studio-heading">
          <span className="studio-brand">
            vanilla<span>Meta</span>
          </span>
          <span className="studio-header-divider" />
          <div>
            <div className="studio-eyebrow">DASHBOARD STUDIO</div>
            <h1>{start ? '새 대시보드' : doc.title}</h1>
          </div>
        </div>
        <div className="studio-header-actions">
          <span className="studio-draft">{product ? product.save.status : '시안 · 저장되지 않음'}</span>
          <Button disabled={!history.canUndo} onClick={history.onUndo}>
            되돌리기
          </Button>
          <Button disabled={!history.canRedo} onClick={history.onRedo}>
            다시 실행
          </Button>
          <span
            role="status"
            aria-live="polite"
            className="studio-history-count"
            aria-label={`편집 이력 ${history.count}회 변경`}
          >
            {history.count}회 변경
          </span>
          {product ? (
            <Button
              variant="contained"
              disableElevation
              onClick={product.save.onSave}
              disabled={product.save.disabled || product.save.pending}
            >
              {product.save.label}
            </Button>
          ) : (
            <>
              <Button variant="outlined" disabled>
                저장
              </Button>
              <Button variant="contained" disableElevation onClick={() => onStageChange('publish')}>
                공유 미리보기
              </Button>
            </>
          )}
        </div>
      </header>
      {!product && (
        <nav className="studio-scenarios" aria-label="디자인 상태">
          <span>시안 보기</span>
          {(
            [
              { id: 'start', label: '01 시작' },
              { id: 'result', label: '02 생성 결과' },
              { id: 'settings', label: '03 블록 설정' },
              { id: 'publish', label: '04 공유' },
            ] as const
          ).map(item => (
            <Button key={item.id} aria-pressed={stage === item.id} onClick={() => onStageChange(item.id)}>
              {item.label}
            </Button>
          ))}
          <label className="studio-status-select">
            상태 시안{' '}
            <select value={status} onChange={e => onStatusChange(e.target.value as 'ready' | 'loading' | 'error')}>
              <option value="ready">정상</option>
              <option value="loading">로딩</option>
              <option value="error">오류</option>
            </select>
          </label>
        </nav>
      )}
      <div className={`studio-workspace ${panel && !start ? 'studio-has-panel' : ''}`}>
        <main id="studio-main" tabIndex={-1}>
          {start ? (
            <section className="studio-welcome" aria-label="새 대시보드 시작">
              <span className="studio-welcome-icon">
                <AutoAwesomeOutlined />
              </span>
              <div className="studio-eyebrow">데이터에서 첫 인사이트까지</div>
              <h2>
                어떤 대시보드를
                <br />
                만들어 볼까요?
              </h2>
              <p>
                데이터를 연결하고 필요한 내용을 설명해 주세요.
                <br />
                지표와 차트를 제안받고, 원하는 모습으로 다듬으세요.
              </p>
              <div className="studio-prompt">
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="만들고 싶은 대시보드"
                  placeholder="예: 매출·환불과 채널별 현황을 한눈에 보여 줘"
                />
                <div className="studio-prompt-footer">
                  <span>데이터 연결은 다음 단계에서 지원합니다</span>
                  <Button disabled variant="contained">
                    생성
                  </Button>
                </div>
              </div>
              <div className="studio-source-choices">
                <Button disabled variant="outlined">
                  파일 연결
                </Button>
                <Button disabled variant="outlined">
                  기존 데이터 선택
                </Button>
                <Button variant="outlined" endIcon={<ArrowForwardOutlined />} onClick={() => onStageChange('result')}>
                  매출·환불 샘플 시안
                </Button>
              </div>
              <div className="studio-start-steps">
                <span>
                  <b>01</b> 데이터 연결
                </span>
                <span>
                  <b>02</b> AI와 제작
                </span>
                <span>
                  <b>03</b> 편집하고 공유
                </span>
              </div>
            </section>
          ) : (
            <>
              <div className="studio-context">
                <div>
                  <span className="studio-source-label">데이터</span>
                  <strong>{product ? product.source : doc.source}</strong>
                  <span className="studio-source-meta">{product ? product.sourceMeta : '주문·환불 · 디자인용 샘플'}</span>
                </div>
                <Button variant="outlined" onClick={() => onPanelChange('ai')} startIcon={<AutoAwesomeOutlined />}>
                  AI 열기
                </Button>
              </div>
              {product?.banner}
              {!product && status === 'error' && (
                <Alert severity="error" className="studio-status-banner">
                  데이터 갱신 오류 안내 시안입니다. 기존 결과와 편집 내용은 보존하고 실패한 단계만 다시 시도합니다. 실제
                  장애가 아닙니다.
                </Alert>
              )}
              {!product && status === 'loading' && (
                <div role="status" className="studio-status-banner studio-loading">
                  로딩 상태 시안 · 새 결과를 준비하는 동안 이전 내용을 유지합니다. 실제 요청은 실행하지 않습니다.
                </div>
              )}
              <div className="studio-canvas-toolbar">
                <div className="studio-filters">
                  {product ? (
                    <>
                      <span className="studio-filter-tag">{product.period}</span>
                      <span className="studio-filter-tag">블록 {product.blockCount}개</span>
                    </>
                  ) : (
                    <>
                      <span className="studio-filter-tag">{doc.period}</span>
                      <span className="studio-filter-tag">모든 채널</span>
                      <span className="studio-filter-tag">KRW</span>
                    </>
                  )}
                </div>
                <span>
                  {product
                    ? '저장하면 기존 대시보드 보기와 같은 데이터를 사용합니다'
                    : '브라우저 안에서 편집 · 새로고침 시 초기화'}
                </span>
              </div>
              <div className="studio-canvas">
                <div className="studio-canvas-title">
                  <div>
                    <h2>{product ? product.canvasTitle : '매출·환불 한눈에 보기'}</h2>
                    <p>{product ? product.canvasDescription : '성과를 확인하고, 변화가 생긴 채널을 살펴보세요.'}</p>
                  </div>
                  <span className="studio-live-label">{product ? product.dataLabel : '가상 데이터'}</span>
                </div>
                {editToolbar}
                {canvas}
              </div>
            </>
          )}
        </main>
        {!start &&
          panel &&
          (compact ? (
            <Drawer className="studio-panel-drawer" anchor="right" open onClose={() => onPanelChange(null)}>
              <div className="vm-studio">{panelContent}</div>
            </Drawer>
          ) : (
            panelContent
          ))}
      </div>
    </div>
  );
}
