import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { StudioBlock, StudioBlockKind, StudioOperation } from './studioTypes';

/** Existing product labels for the block kinds the Studio document supports. */
const KIND_LABELS: Record<StudioBlockKind, string> = {
  BOARD_NUMERIC: '숫자판',
  CHART_COLUMN: '막대형 가로 차트',
  CHART_BAR: '막대형 세로 차트',
  CHART_LINE: '선형 차트',
};
const NOTATION_LABELS = { full: '전체 숫자', compact: '축약 (K/M/B/T)' } as const;
const DECIMAL_OPTIONS = [0, 1, 2];
const MAX_BLOCKS = 6;
const TITLE_MAX = 300;
const DESCRIPTION_MAX = 1000;
const TITLE_REQUIRED = '블록 제목을 입력해 주세요. 빈 제목으로는 바꿀 수 없습니다.';

export type StudioInspectorProps = {
  block: StudioBlock | null;
  onOperation: (operation: StudioOperation) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canDuplicate: boolean;
};

const notationOf = (block: StudioBlock): 'full' | 'compact' =>
  block.display.numberNotation === 'compact' ? 'compact' : 'full';
const decimalsOf = (block: StudioBlock): number => {
  const value = block.display.decimalPlaces;
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0;
};
const measureSummary = (block: StudioBlock) =>
  block.measureRefs.length
    ? `지표 · ${block.measureRefs.map(ref => `ID ${ref.id} (${ref.definitionVersion})`).join(', ')}`
    : '지표 · 연결된 구조화 지표 참조 없음';
const dimensionSummary = (block: StudioBlock) =>
  block.dimensionRefs.length
    ? `나눠 볼 기준 · ${block.dimensionRefs.map(ref => `${ref.key} (${ref.schemaVersion})`).join(', ')}`
    : '나눠 볼 기준 · 연결된 차원 참조 없음';

/** Block settings for the selected Studio block. Arrow keys stay in the field while editing. */
export default function StudioInspector({ block, onOperation, onDuplicate, onRemove, canDuplicate }: StudioInspectorProps) {
  const [titleDraft, setTitleDraft] = useState(block?.title ?? '');
  const [descriptionDraft, setDescriptionDraft] = useState(block?.description ?? '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const descriptionInput = useRef<HTMLInputElement | null>(null);
  const sentTitle = useRef<string | null>(null);
  const sentDescription = useRef<string | null>(null);

  // The local draft is authoritative while typing; a document change replaces it only outside the field.
  useEffect(() => {
    if (document.activeElement === titleInput.current) return;
    setTitleDraft(block?.title ?? '');
    setTitleError(null);
    sentTitle.current = null;
  }, [block?.id, block?.title]);
  useEffect(() => {
    if (document.activeElement === descriptionInput.current) return;
    setDescriptionDraft(block?.description ?? '');
    sentDescription.current = null;
  }, [block?.id, block?.description]);

  const commitTitle = () => {
    if (!block) return;
    const next = titleDraft.trim();
    if (!next) {
      setTitleError(TITLE_REQUIRED);
      setTitleDraft(block.title);
      return;
    }
    setTitleError(null);
    setTitleDraft(next);
    const sent = `${block.id}:${next}`;
    if (next === block.title || sentTitle.current === sent) return;
    sentTitle.current = sent;
    onOperation({ type: 'updateBlock', blockId: block.id, patch: { title: next } });
  };

  const commitDescription = () => {
    if (!block) return;
    const next = descriptionDraft.trim();
    setDescriptionDraft(next);
    const sent = `${block.id}:${next}`;
    if (next === block.description || sentDescription.current === sent) return;
    sentDescription.current = sent;
    onOperation({ type: 'updateBlock', blockId: block.id, patch: { description: next } });
  };

  const keepArrowsInField = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key.startsWith('Arrow')) event.stopPropagation();
  };
  const commitTitleOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
    keepArrowsInField(event);
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    commitTitle();
  };
  const commitDescriptionOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
    keepArrowsInField(event);
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    commitDescription();
  };

  const changeNotation = (value: string) => {
    if (!block || value === notationOf(block)) return;
    onOperation({
      type: 'updateBlock',
      blockId: block.id,
      patch: { display: { numberNotation: value === 'compact' ? 'compact' : 'full' } },
    });
  };
  const changeDecimals = (value: number) => {
    if (!block || !Number.isInteger(value) || value === decimalsOf(block)) return;
    onOperation({ type: 'updateBlock', blockId: block.id, patch: { display: { decimalPlaces: value } } });
  };

  if (!block)
    return (
      <div className="studio-inspector">
        <span className="studio-eyebrow">선택한 블록</span>
        <h2>블록을 선택해 주세요</h2>
        <p>캔버스에서 블록을 선택하면 이곳에서 제목·설명과 숫자 표시를 바꿀 수 있습니다.</p>
        <div className="studio-definition">
          <b>이 패널에서 할 수 있는 일</b>
          <span>블록 제목과 설명 수정</span>
          <span>숫자 표시와 소수 자릿수 선택</span>
          <span>블록 복제 · 삭제</span>
        </div>
        <div className="studio-inspector-actions">
          <Button variant="outline" disabled>
            블록 복제
          </Button>
          <Button variant="ghost" disabled>
            블록 삭제
          </Button>
        </div>
        <p className="studio-panel-note">블록을 선택하기 전에는 설정을 바꿀 수 없습니다.</p>
      </div>
    );

  const decimals = decimalsOf(block);
  const decimalOptions = DECIMAL_OPTIONS.includes(decimals)
    ? DECIMAL_OPTIONS
    : [...DECIMAL_OPTIONS, decimals].sort((a, b) => a - b);

  return (
    <div className="studio-inspector">
      <span className="studio-eyebrow">선택한 블록</span>
      <h2>{block.title}</h2>
      <p>제목과 설명, 숫자 표시를 조정합니다. 종류와 계산 정의는 읽기 전용입니다.</p>
      <TextField
        inputRef={titleInput}
        label="블록 제목"
        value={titleDraft}
        error={Boolean(titleError)}
        helperText={titleError ?? undefined}
        onChange={event => setTitleDraft(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={commitTitleOnEnter}
        maxLength={TITLE_MAX}
      />
      <TextField
        inputRef={descriptionInput}
        label="설명"
        value={descriptionDraft}
        onChange={event => setDescriptionDraft(event.target.value)}
        onBlur={commitDescription}
        onKeyDown={commitDescriptionOnEnter}
        maxLength={DESCRIPTION_MAX}
      />
      <TextField
        select
        label="숫자 표시"
        value={notationOf(block)}
        helperText="축약은 1,200,000을 1.2M처럼 줄여 표시합니다."
        onChange={event => changeNotation(event.target.value)}
        onKeyDown={keepArrowsInField}
      >
        <option value="full">{NOTATION_LABELS.full}</option>
        <option value="compact">{NOTATION_LABELS.compact}</option>
      </TextField>
      <TextField
        select
        label="소수 자릿수"
        value={decimals}
        onChange={event => changeDecimals(Number(event.target.value))}
        onKeyDown={keepArrowsInField}
      >
        {decimalOptions.map(value => (
          <option key={value} value={value}>
            {value}자리
          </option>
        ))}
      </TextField>
      <TextField label="블록 종류" value={KIND_LABELS[block.kind]} readOnly />
      <div className="studio-definition">
        <b>계산 정의 · 읽기 전용</b>
        <code>{block.definitionKey}</code>
        <span>{measureSummary(block)}</span>
        <span>{dimensionSummary(block)}</span>
      </div>
      <div className="studio-inspector-actions">
        <Button
          variant="outline"
          onClick={onDuplicate}
          disabled={!canDuplicate}
          aria-describedby={canDuplicate ? undefined : 'studio-block-limit'}
        >
          블록 복제
        </Button>
        <Button variant="ghost" onClick={onRemove}>
          블록 삭제
        </Button>
      </div>
      {!canDuplicate && (
        <p className="studio-panel-note" id="studio-block-limit">
          블록은 대시보드마다 최대 {MAX_BLOCKS}개까지 만들 수 있습니다. 복제하려면 기존 블록을 삭제해 주세요.
        </p>
      )}
      <p className="studio-panel-note">
        제목과 설명은 Enter를 누르거나 입력란 밖을 클릭하면 적용됩니다. 변경은 되돌리기로 취소할 수 있습니다.
      </p>
    </div>
  );
}
