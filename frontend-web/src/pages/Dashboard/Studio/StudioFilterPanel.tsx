import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import {
  studioAssert,
  studioFilterDraftKey,
  studioFilterKey,
  studioFilterValueKey,
  studioFilterValueLabel,
} from './studioDocument';
import { StudioFilterChoice } from './studioApi';
import { STUDIO_FILTER_LIMITS, StudioFilter, StudioFilterValue } from './studioTypes';

export type StudioFilterPanelProps = {
  /** Current document scope. Undo, redo, save and remount all flow back through this prop. */
  filters: StudioFilter[];
  /** Source-wide categorical choices from the last preview response. */
  choices: StudioFilterChoice[];
  /** Scope actually confirmed for the data on screen. Never claims a pending or failed edit. */
  scopeLabel: string;
  /** Honest note when the document scope is ahead of the confirmed preview. */
  pendingLabel: string | null;
  busy: boolean;
  disabled?: boolean;
  error: string | null;
  message: string | null;
  onApply: (filters: StudioFilter[]) => void;
  onRetry: () => void;
};

/**
 * Selected values come first and are never dropped, so a saved NULL or stale value stays visible and
 * uncheckable even when the source offers fifty other choices. Remaining choices fill the limit.
 */
export const studioFilterOptions = (choice: StudioFilterChoice | undefined, selected: StudioFilterValue[]) => {
  const selectedKeys = new Set(selected.map(studioFilterValueKey));
  const remaining = (choice?.values ?? []).filter(value => !selectedKeys.has(studioFilterValueKey(value)));
  const capacity = Math.max(0, STUDIO_FILTER_LIMITS.values - selected.length);
  return [...selected, ...remaining.slice(0, capacity)];
};

/** Every applied column needs at least one value. An empty list is the valid "filters cleared" state. */
export const studioFiltersComplete = (filters: StudioFilter[]) =>
  filters.every(filter => filter.values.length > 0 && filter.values.length <= STUDIO_FILTER_LIMITS.values);

export default function StudioFilterPanel({
  filters,
  choices,
  scopeLabel,
  pendingLabel,
  busy,
  disabled,
  error,
  message,
  onApply,
  onRetry,
}: StudioFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StudioFilter[]>(filters);
  const toggle = useRef<HTMLButtonElement>(null);
  const latest = useRef(filters);
  latest.current = filters;
  const applied = studioFilterKey(filters);
  // The document is the source of truth: a filter edit is replaced by the undo/redo/save value.
  // Only the confirmed scope is a dependency, so a parent re-render never discards an unfinished draft.
  useEffect(() => {
    setDraft((current: StudioFilter[]) => (studioFilterDraftKey(current) === applied ? current : latest.current));
  }, [applied]);
  const available = useMemo(
    () => choices.filter(choice => !draft.some(filter => filter.column === choice.column)),
    [choices, draft],
  );
  const dirty = studioFilterDraftKey(draft) !== applied;
  const complete = studioFiltersComplete(draft);
  const setValues = (column: string, values: StudioFilterValue[]) =>
    setDraft(current => current.map(filter => (filter.column === column ? { column, values } : filter)));
  const addColumn = (column: string) => {
    studioAssert(!draft.some(filter => filter.column === column), '이미 필터에 있는 열입니다.');
    setDraft(current => [...current, { column, values: [] }]);
  };
  return (
    <section
      className="studio-filter-panel"
      aria-label="공통 필터"
      aria-busy={busy}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }}
    >
      <div className="studio-filter-panel-header">
        <Button
          ref={toggle}
          className="studio-filter-toggle"
          aria-expanded={open}
          aria-controls="studio-filter-body"
          onClick={() => setOpen(value => !value)}
          disabled={disabled}
        >
          {open ? '공통 필터 접기' : '공통 필터'}
          {filters.length ? ' · ' + filters.length : ''}
        </Button>
        <span className="studio-filter-scope">{scopeLabel}</span>
        {pendingLabel && (
          <span className="studio-filter-pending" role="status">
            {pendingLabel}
          </span>
        )}
      </div>
      {open && (
        <div id="studio-filter-body" className="studio-filter-panel-body">
          <Typography variant="body2" className="studio-filter-help">
            선택한 값을 적용하면 모든 블록을 같은 조건으로 다시 조회합니다. 값은 입력하는 동안이 아니라 적용할 때 조회합니다.
            열 {STUDIO_FILTER_LIMITS.columns}개, 열마다 값 {STUDIO_FILTER_LIMITS.values}개까지 지원합니다.
          </Typography>
          {error && (
            <Alert severity="error" role="alert" className="studio-filter-alert">
              {error}
              <Button size="small" onClick={onRetry} disabled={busy}>
                다시 시도
              </Button>
            </Alert>
          )}
          {message && !error && (
            <Typography variant="body2" className="studio-filter-message" role="status">
              {message}
            </Typography>
          )}
          <div className="studio-filter-add">
            <TextField
              select
              size="small"
              label="필터 열 추가"
              value=""
              disabled={disabled || draft.length >= STUDIO_FILTER_LIMITS.columns || !available.length}
              onChange={event => {
                if (event.target.value) addColumn(String(event.target.value));
              }}
            >
              <MenuItem value="">열 선택</MenuItem>
              {available.map(choice => (
                <MenuItem key={choice.column} value={choice.column}>
                  {choice.column} ({choice.values.length})
                </MenuItem>
              ))}
            </TextField>
            <span className="studio-filter-count">
              {draft.length}/{STUDIO_FILTER_LIMITS.columns}개 열
            </span>
          </div>
          {!draft.length && (
            <Typography variant="body2">적용된 공통 필터가 없습니다. 모든 블록이 전체 범위를 조회합니다.</Typography>
          )}
          {draft.map(filter => {
            const choice = choices.find(candidate => candidate.column === filter.column);
            const options = studioFilterOptions(choice, filter.values);
            const selected = new Set(filter.values.map(studioFilterValueKey));
            return (
              <div className="studio-filter-group" key={filter.column}>
                <div className="studio-filter-group-head">
                  <strong>{filter.column}</strong>
                  <span>
                    {filter.values.length}/{STUDIO_FILTER_LIMITS.values}개 값{!choice && ' · 저장된 값'}
                  </span>
                  <Button
                    size="small"
                    aria-label={filter.column + ' 필터 제거'}
                    disabled={disabled || busy}
                    onClick={() => setDraft(current => current.filter(candidate => candidate.column !== filter.column))}
                  >
                    제거
                  </Button>
                </div>
                {options.length ? (
                  <div className="studio-filter-values" role="group" aria-label={filter.column + ' 값 선택'}>
                    {options.map(value => {
                      const key = studioFilterValueKey(value);
                      const checked = selected.has(key);
                      return (
                        <FormControlLabel
                          key={key}
                          className="studio-filter-value"
                          control={
                            <Checkbox
                              size="small"
                              checked={checked}
                              disabled={
                                disabled || busy || (!checked && filter.values.length >= STUDIO_FILTER_LIMITS.values)
                              }
                              onChange={() =>
                                setValues(
                                  filter.column,
                                  checked
                                    ? filter.values.filter(item => studioFilterValueKey(item) !== key)
                                    : [...filter.values, value],
                                )
                              }
                            />
                          }
                          label={studioFilterValueLabel(value)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <Typography variant="body2" className="studio-filter-empty">
                    이 열의 선택 가능한 값 목록이 아직 없습니다. 저장된 값을 유지합니다. 값을 바꾸려면 이 열이 필터 값 목록에
                    나타난 뒤 선택하세요.
                  </Typography>
                )}
                {!filter.values.length && (
                  <Typography variant="body2" className="studio-filter-incomplete" role="alert">
                    값을 하나 이상 선택해야 적용할 수 있습니다.
                  </Typography>
                )}
              </div>
            );
          })}
          <div className="studio-filter-actions">
            <Button onClick={() => setDraft([])} disabled={disabled || busy || !draft.length}>
              필터 전체 해제
            </Button>
            <span className="studio-filter-dirty" role="status">
              {dirty ? '적용하지 않은 변경이 있습니다' : '적용된 조건과 같습니다'}
            </span>
            <Button
              variant="contained"
              disableElevation
              disabled={disabled || busy || !dirty || !complete}
              onClick={() => onApply(draft)}
            >
              {busy ? '적용 중…' : '적용'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
