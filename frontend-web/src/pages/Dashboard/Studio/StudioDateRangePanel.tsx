import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { studioDateRangeKey, studioDateRangeSummary, validateStudioDateRange } from './studioDocument';
import { StudioDateRange } from './studioTypes';

/** One server-proven temporal column. Bounds are display hints from the preview payload. */
export type StudioDateRangeColumn = { column: string; min?: string | null; max?: string | null };
export type StudioDateDraft = { column: string; start: string; end: string };
export type StudioDateDraftStatus = 'empty' | 'incomplete' | 'reversed' | 'invalid' | 'ready';

export type StudioDateRangePanelProps = {
  /** Applied period from the document. Absent or null means the whole period is in scope. */
  dateRange?: StudioDateRange | null;
  /** preview.temporalColumns verbatim, so the panel offers exactly the server-confirmed columns. */
  columns?: StudioDateRangeColumn[];
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  pending?: string | null;
  message?: string | null;
  onApply: (dateRange: StudioDateRange | null) => void;
};

/** Last UTC day inside an exclusive instant bound, so midnight ends keep the day they cover. */
const lastIncludedDay = (end: string) => {
  const time = Date.parse(end);
  return Number.isFinite(time) ? new Date(time - 1).toISOString().slice(0, 10) : end.slice(0, 10);
};
/** Calendar-day draft of the applied period; an instant range contributes the days it covers. */
export const studioDateRangeDraft = (dateRange?: StudioDateRange | null): StudioDateDraft =>
  dateRange
    ? {
        column: dateRange.column,
        start: dateRange.start.slice(0, 10),
        end: dateRange.precision === 'timestamp' ? lastIncludedDay(dateRange.end) : dateRange.end,
      }
    : { column: '', start: '', end: '' };
export const studioDateDraftRange = (draft: StudioDateDraft): StudioDateRange => ({
  column: draft.column.trim(),
  start: draft.start,
  end: draft.end,
});
/**
 * One review of the draft: the protocol validator decides readiness, so an impossible calendar day,
 * a range without a representable day after it, or a missing field can never reach apply.
 */
export const studioDateDraftReview = (draft: StudioDateDraft): { status: StudioDateDraftStatus; message: string } => {
  const filled = [draft.column, draft.start, draft.end].filter(value => !!value.trim()).length;
  if (!filled) return { status: 'empty', message: '' };
  if (filled < 3) return { status: 'incomplete', message: '열·시작일·종료일을 모두 입력해야 적용할 수 있습니다.' };
  if (draft.start > draft.end)
    return { status: 'reversed', message: '시작일이 종료일보다 늦을 수 없습니다. UTC 날짜를 확인해 주세요.' };
  try {
    validateStudioDateRange(studioDateDraftRange(draft));
    return { status: 'ready', message: '' };
  } catch (error) {
    return {
      status: 'invalid',
      message: error instanceof Error ? error.message : '기간 형식을 확인해 주세요.',
    };
  }
};
export const studioDateDraftStatus = (draft: StudioDateDraft): StudioDateDraftStatus => studioDateDraftReview(draft).status;

export default function StudioDateRangePanel({
  dateRange = null,
  columns = [],
  busy = false,
  disabled = false,
  error = null,
  pending = null,
  message = null,
  onApply,
}: StudioDateRangePanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StudioDateDraft>(studioDateRangeDraft(dateRange));
  const [draftError, setDraftError] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  const latest = useRef(dateRange);
  latest.current = dateRange;
  const applied = studioDateRangeKey(dateRange);
  // Only a change of the applied period resets the draft: a parent re-render keeps an unfinished edit.
  useEffect(() => {
    setDraft(studioDateRangeDraft(latest.current));
  }, [applied]);
  const review = studioDateDraftReview(draft);
  const status = review.status;
  const appliedDraft = studioDateRangeDraft(dateRange);
  const dirty = draft.column !== appliedDraft.column || draft.start !== appliedDraft.start || draft.end !== appliedDraft.end;
  const options = useMemo(
    () =>
      columns.some(choice => choice.column === draft.column) || !draft.column
        ? columns
        : [{ column: draft.column }, ...columns],
    [columns, draft.column],
  );
  const set = (patch: Partial<StudioDateDraft>) => setDraft(current => ({ ...current, ...patch }));
  const apply = () => {
    // An invalid draft reports why instead of silently doing nothing.
    if (status !== 'ready') {
      setDraftError(review.message || '기간을 확인해 주세요.');
      return;
    }
    setDraftError('');
    onApply(studioDateDraftRange(draft));
  };
  return (
    <section
      className="studio-date-range"
      aria-label="공통 기간"
      aria-busy={busy}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }}
    >
      <div className="studio-date-range-header">
        <Button
          variant="ghost"
          ref={toggle}
          className="studio-date-range-toggle"
          aria-expanded={open}
          aria-controls="studio-date-range-body"
          onClick={() => setOpen(value => !value)}
          disabled={disabled}
        >
          {open ? '공통 기간 접기' : '공통 기간'}
        </Button>
        <span className="studio-date-range-scope">{studioDateRangeSummary(dateRange)}</span>
        {pending && (
          <span className="studio-date-range-pending" role="status">
            {pending}
          </span>
        )}
      </div>
      {open && (
        <div id="studio-date-range-body" className="studio-date-range-body">
          <p className="studio-date-range-help">
            UTC 날짜로 기간을 정하고 적용하면 모든 블록을 같은 기간으로 다시 조회합니다. 입력하는 동안에는 조회하지 않습니다.
            적용을 누르면 이 문서에 반영되고 저장 전까지 초안으로 유지됩니다.
          </p>
          {error && (
            <Notice severity="error" role="alert" className="studio-date-range-alert">
              {error}
            </Notice>
          )}
          {message && !error && (
            <p className="studio-date-range-message" role="status">
              {message}
            </p>
          )}
          {dateRange?.precision === 'timestamp' && (
            <Notice severity="info" className="studio-date-range-help">
              저장된 기간은 초 단위 정밀 범위입니다. 아래 날짜를 적용하면 UTC 날짜 범위로 대체됩니다.
            </Notice>
          )}
          {!!dateRange?.timeZone && dateRange.timeZone !== 'UTC' && (
            <Notice severity="warning" className="studio-date-range-help">
              저장된 기간은 {dateRange.timeZone} 기준입니다. 이 패널은 UTC 날짜로 적용하므로 적용하면 {dateRange.timeZone}{' '}
              범위는 UTC 날짜 범위로 대체됩니다.
            </Notice>
          )}
          {draftError && (
            <Notice severity="error" role="alert" className="studio-date-range-alert">
              {draftError}
            </Notice>
          )}
          {status === 'incomplete' && (
            <Notice severity="warning" role="alert" className="studio-date-range-alert">
              열·시작일·종료일을 모두 입력해야 적용할 수 있습니다.
            </Notice>
          )}
          {status === 'reversed' && (
            <Notice severity="warning" role="alert" className="studio-date-range-alert">
              시작일이 종료일보다 늦을 수 없습니다. UTC 날짜를 확인해 주세요.
            </Notice>
          )}
          {status === 'invalid' && (
            <Notice severity="warning" role="alert" className="studio-date-range-alert">
              {review.message}
            </Notice>
          )}
          <div className="studio-date-range-fields">
            <TextField
              className="studio-date-range-column"
              select
              label="기간 열"
              value={draft.column}
              disabled={disabled || busy}
              onChange={event => set({ column: String(event.target.value) })}
            >
              <option value="">열 선택</option>
              {options.map(choice => (
                <option key={choice.column} value={choice.column}>
                  {choice.column}
                  {choice.min && choice.max ? ' (' + choice.min + ' ~ ' + choice.max + ')' : ''}
                </option>
              ))}
            </TextField>
            <TextField
              className="studio-date-range-date"
              type="date"
              label="시작일 (UTC)"
              value={draft.start}
              disabled={disabled || busy}
              onChange={event => set({ start: event.target.value })}
            />
            <TextField
              className="studio-date-range-date"
              type="date"
              label="종료일 (UTC)"
              value={draft.end}
              disabled={disabled || busy}
              onChange={event => set({ end: event.target.value })}
            />
          </div>
          {!!columns.length && (
            <p className="studio-date-range-hint">
              서버가 확인한 기간 열 {columns.length}개 · 값이 없는 열은 목록에 없습니다.
            </p>
          )}
          <div className="studio-date-range-actions">
            <Button
              variant="ghost"
              className="studio-date-range-reset"
              onClick={() => {
                setDraftError('');
                setDraft({ column: '', start: '', end: '' });
              }}
              disabled={disabled || busy || status === 'empty'}
            >
              입력 초기화
            </Button>
            <Button
              variant="ghost"
              className="studio-date-range-reset"
              onClick={() => onApply(null)}
              disabled={disabled || busy || !dateRange}
            >
              기간 전체 해제
            </Button>
            <span className="studio-date-range-dirty" role="status">
              {dirty ? '적용하지 않은 변경이 있습니다' : '적용된 기간과 같습니다'}
            </span>
            <Button
              className="studio-date-range-apply"
              variant="default"
              disabled={disabled || busy || !dirty || status !== 'ready'}
              onClick={apply}
            >
              {busy ? '적용 중…' : '적용'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
