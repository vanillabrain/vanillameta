import React, { useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery } from '@mui/material';
import StudioShell, { StudioDesignDocument, StudioDesignStage } from './StudioShell';

/** Synthetic, development-only preview. No API requests, real source data, or generated claims. */
export default function StudioDesignPreview() {
  const [document, setDocument] = useState<StudioDesignDocument>({
    title: '온라인 스토어 매출·환불',
    source: '주문·환불 샘플.csv',
    period: '2026.10.01 – 10.07',
    blockTitle: '일별 매출 추이',
  });
  const compact = useMediaQuery('(max-width:899px)', { noSsr: true });
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready');
  const [stage, setStage] = useState<StudioDesignStage>('result');
  const [panel, setPanel] = useState<'ai' | 'settings' | null>(compact ? null : 'ai');
  const previousStage = useRef<StudioDesignStage>('result');
  const changeStage = (next: StudioDesignStage) => {
    if (next === 'publish') previousStage.current = stage === 'publish' ? 'result' : stage;
    setStage(next);
    if (next === 'settings') setPanel('settings');
    if (next === 'result') setPanel(compact ? null : 'ai');
  };
  return (
    <>
      <StudioShell
        document={document}
        stage={stage}
        status={status}
        onStatusChange={setStatus}
        panel={panel}
        onStageChange={changeStage}
        onPanelChange={setPanel}
        onBlockTitleChange={blockTitle => setDocument(old => ({ ...old, blockTitle }))}
      />
      <Dialog
        open={stage === 'publish'}
        onClose={() => setStage(previousStage.current)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="studio-publish-heading"
      >
        <DialogTitle id="studio-publish-heading">공유할 내용 확인</DialogTitle>
        <DialogContent className="studio-publish-content">
          <p className="studio-publish-notice">공유 화면의 디자인 시안입니다. 링크는 생성되지 않습니다.</p>
          <h3>{document.title}</h3>
          <dl>
            <div>
              <dt>공유 범위</dt>
              <dd>링크를 가진 사람</dd>
            </div>
            <div>
              <dt>데이터</dt>
              <dd>집계 결과 스냅샷</dd>
            </div>
            <div>
              <dt>조회 기간</dt>
              <dd>{document.period}</dd>
            </div>
            <div>
              <dt>게시 상태</dt>
              <dd>미게시 · 가상 데이터</dd>
            </div>
          </dl>
          <p>
            초안 수정은 게시 결과를 바꾸지 않습니다.
            <br />
            공유할 때의 데이터 시점과 범위를 표시합니다.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStage(previousStage.current)}>편집 시안으로 돌아가기</Button>
          <Button disabled variant="contained">
            게시하고 링크 복사
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
