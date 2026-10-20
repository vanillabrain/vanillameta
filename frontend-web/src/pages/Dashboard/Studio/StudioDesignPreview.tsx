import { NativeSelect } from '@/components/ui/native-select';
import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useMinWidth } from '@/components/PageViewBox';
import StudioCanvas from './StudioCanvas';
import StudioInspector from './StudioInspector';
import { createStudioState, studioReducer, applyStudioOperation } from './studioReducer';
import { studioOrderOperations } from './studioEditing';
import { sampleBlock, studioSample } from './studioSample';
import { StudioOperation, STUDIO_COLUMNS, STUDIO_BREAKPOINTS } from './studioTypes';
import StudioShell, { StudioDesignDocument, StudioDesignStage } from './StudioShell';

/** Synthetic, development-only preview. No API requests, real source data, or generated claims. */
export default function StudioDesignPreview() {
  const [state, dispatch] = useReducer(studioReducer, studioSample, createStudioState);
  const [message, setMessage] = useState('');
  const tablet = !useMinWidth(1200);
  const mobile = !useMinWidth(600);
  const breakpoint = mobile ? 'xs' : tablet ? 'md' : 'lg';
  useEffect(() => dispatch({ type: 'breakpoint', breakpoint }), [breakpoint]);
  const document: StudioDesignDocument = {
    title: state.present.title,
    source: '주문·환불 샘플.csv',
    period: '2026.10.01 – 10.07',
    blockTitle: state.present.blocks.find(b => b.id === state.selectedBlockId)?.title ?? '블록을 선택하세요',
  };
  const applyOperations = (operations: StudioOperation[]) => {
    if (!operations.length) return false;
    try {
      operations.reduce(applyStudioOperation, state.present);
      dispatch({ type: 'applyBatch', operations });
      setMessage('편집 내용을 반영했습니다. 아직 저장되지 않았습니다.');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '편집을 적용하지 못했습니다. 기존 내용을 유지했습니다.');
      return false;
    }
  };
  const operation = (op: StudioOperation) => applyOperations([op]);
  const nextId = () => {
    if (!crypto.randomUUID) {
      setMessage('이 브라우저에서는 새 블록 ID를 만들 수 없습니다. localhost 또는 HTTPS로 열어 주세요.');
      return null;
    }
    return `new:${crypto.randomUUID()}`;
  };
  const selected = state.present.blocks.find(b => b.id === state.selectedBlockId) ?? null;
  const geometry = state.present.layouts[breakpoint].find(g => g.id === state.selectedBlockId);
  const ordered = [...state.present.layouts[breakpoint]].sort((a, b) => a.y - b.y || a.x - b.x);
  const selectedOrder = ordered.findIndex(g => g.id === state.selectedBlockId);
  const reorder = (direction: -1 | 1) => {
    if (!state.selectedBlockId) return;
    const operations = studioOrderOperations(state.present, breakpoint, state.selectedBlockId, direction);
    if (!operations.length) return;
    if (applyOperations(operations)) setMessage('현재 화면 크기의 블록 순서를 변경했습니다.');
  };
  const compact = !useMinWidth(900);
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready');
  const [stage, setStage] = useState<StudioDesignStage>('result');
  const [panel, setPanel] = useState<'ai' | 'settings' | null>(compact ? null : 'ai');
  useEffect(() => {
    if (compact) setPanel(null);
  }, [compact]);
  const previousStage = useRef<StudioDesignStage>('result');
  const changeStage = (next: StudioDesignStage) => {
    if (next === 'publish') previousStage.current = stage === 'publish' ? 'result' : stage;
    setStage(next);
    if (next === 'settings') {
      dispatch({ type: 'select', blockId: state.selectedBlockId ?? state.present.blocks[0]?.id ?? null });
      setPanel('settings');
    }
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
        history={{
          canUndo: !!state.past.length,
          canRedo: !!state.future.length,
          count: state.past.length,
          onUndo: () => dispatch({ type: 'undo' }),
          onRedo: () => dispatch({ type: 'redo' }),
        }}
        canvas={
          <StudioCanvas
            document={state.present}
            breakpoint={breakpoint}
            selectedBlockId={state.selectedBlockId}
            onOperation={operation}
            onSelect={blockId => dispatch({ type: 'select', blockId })}
            onSettings={() => setPanel('settings')}
          />
        }
        inspector={
          <StudioInspector
            key={selected?.id ?? 'none'}
            block={selected}
            onOperation={operation}
            canDuplicate={state.present.blocks.length < 6}
            onDuplicate={() => {
              const id = nextId();
              if (selected && id) operation({ type: 'duplicateBlock', blockId: selected.id, newId: id });
            }}
            onRemove={() => {
              if (selected) {
                operation({ type: 'removeBlock', blockId: selected.id });
                setPanel(null);
              }
            }}
          />
        }
        editToolbar={
          <>
            <div className="studio-edit-toolbar">
              <label>
                블록 추가
                <NativeSelect
                  aria-label="추가할 블록"
                  disabled={state.present.blocks.length >= 6}
                  value=""
                  onChange={e => {
                    if (!e.target.value) return;
                    const id = nextId();
                    if (!id) return;
                    const block = sampleBlock(id, e.target.value as 'BOARD_NUMERIC' | 'CHART_LINE', '새 매출 블록');
                    applyOperations([
                      { type: 'addBlock', block },
                      ...STUDIO_BREAKPOINTS.map(bp => ({
                        type: 'resizeBlock' as const,
                        blockId: block.id,
                        breakpoint: bp,
                        w: bp === 'xs' ? 1 : block.kind === 'BOARD_NUMERIC' ? STUDIO_COLUMNS[bp] / 2 : STUDIO_COLUMNS[bp],
                        h: block.kind === 'BOARD_NUMERIC' ? 5 : 6,
                      })),
                    ]);
                  }}
                >
                  <option value="">유형 선택</option>
                  <option value="BOARD_NUMERIC">숫자 지표</option>
                  <option value="CHART_LINE">시계열 차트</option>
                </NativeSelect>
              </label>
              <span>
                {state.present.blocks.length}/6 블록 ·{' '}
                {breakpoint === 'xs' ? '모바일' : breakpoint === 'md' ? '태블릿' : '데스크톱'} 배치
              </span>
              {selected && geometry && (
                <div className="studio-placement" role="group" aria-label="선택 블록 배치">
                  <Button variant="ghost" disabled={selectedOrder <= 0} onClick={() => reorder(-1)}>
                    앞으로
                  </Button>
                  <Button variant="ghost" disabled={selectedOrder >= ordered.length - 1} onClick={() => reorder(1)}>
                    뒤로
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      operation({
                        type: 'resizeBlock',
                        blockId: selected.id,
                        breakpoint,
                        w:
                          breakpoint === 'xs'
                            ? 1
                            : Math.min(STUDIO_COLUMNS[breakpoint] - geometry.x, Math.ceil(STUDIO_COLUMNS[breakpoint] / 2)),
                        h: selected.kind === 'BOARD_NUMERIC' ? 5 : 6,
                      })
                    }
                  >
                    기본 크기
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      operation({
                        type: 'resizeBlock',
                        blockId: selected.id,
                        breakpoint,
                        w: STUDIO_COLUMNS[breakpoint] - geometry.x,
                        h: Math.max(geometry.h, 6),
                      })
                    }
                  >
                    크게
                  </Button>
                </div>
              )}
            </div>
            <p role="status" className="studio-edit-message">
              {message || '블록을 선택해 내용·순서·크기를 편집하세요. 최대 6개 블록을 지원합니다.'}
            </p>
          </>
        }
      />
      <Dialog
        open={stage === 'publish'}
        onOpenChange={open => {
          if (!open) setStage(previousStage.current);
        }}
        aria-labelledby="studio-publish-heading"
      >
        <DialogContent className="studio-publish-content sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle id="studio-publish-heading">공유할 내용 확인</DialogTitle>
            <DialogDescription>공유 화면의 디자인 시안입니다. 실제 게시나 링크 생성은 실행하지 않습니다.</DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStage(previousStage.current)}>
              편집 시안으로 돌아가기
            </Button>
            <Button disabled variant="default">
              게시하고 링크 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
