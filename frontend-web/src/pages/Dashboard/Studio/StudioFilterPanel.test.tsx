import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StudioFilterPanel, { studioFilterOptions, StudioFilterPanelProps } from './StudioFilterPanel';
import { STUDIO_FILTER_LIMITS, StudioFilter } from './studioTypes';

// The repository's Vitest runtime cannot import the Emotion/MUI styled engine.
vi.mock('@mui/material', () => {
  const container = ({ children, component: Tag = 'div' }: any) => <Tag>{children}</Tag>;
  return {
    Box: container,
    Typography: container,
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    FormControlLabel: ({ control, label }: any) => (
      <label>
        {control}
        {label}
      </label>
    ),
    Checkbox: ({ checked, disabled, onChange }: any) => (
      <input type="checkbox" role="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
    ),
    Button: React.forwardRef<HTMLButtonElement, any>(({ children, onClick, disabled, ...props }, ref) => (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        aria-label={props['aria-label']}
        aria-expanded={props['aria-expanded']}
      >
        {children}
      </button>
    )),
    TextField: ({ label, value, onChange, select, children, disabled }: any) =>
      select ? (
        <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>
          {children}
        </select>
      ) : (
        <label>
          {label}
          <input value={value} onChange={onChange} />
        </label>
      ),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const choices = [{ column: 'device_type', values: ['Mobile/Tablet', 'Desktop'] }];
const mount = (over: Partial<StudioFilterPanelProps> = {}) => {
  const onApply = vi.fn();
  const onRetry = vi.fn();
  const view = render(
    <StudioFilterPanel
      filters={[]}
      choices={choices}
      scopeLabel="화면 반영 · 공통 필터 없음"
      pendingLabel={null}
      busy={false}
      error={null}
      message={null}
      onApply={onApply}
      onRetry={onRetry}
      {...over}
    />,
  );
  return { onApply, onRetry, view };
};
const open = () => fireEvent.click(screen.getByRole('button', { name: /^공통 필터/ }));
const addColumn = (column: string) => fireEvent.change(screen.getByLabelText('필터 열 추가'), { target: { value: column } });
const apply = () => screen.getByRole('button', { name: '적용' }) as HTMLButtonElement;

describe('Studio common filter panel', () => {
  it('adds one column, blocks apply until a value exists, and applies only on the explicit action', () => {
    const { onApply } = mount();
    open();
    addColumn('device_type');
    expect(screen.getByText('값을 하나 이상 선택해야 적용할 수 있습니다.')).toBeTruthy();
    expect(apply().disabled).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Mobile/Tablet'));
    // Selecting a value never queries by itself: only the explicit apply is a request.
    expect(onApply).not.toHaveBeenCalled();
    expect(apply().disabled).toBe(false);
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith([{ column: 'device_type', values: ['Mobile/Tablet'] }]);
  });

  it('clears every filter with one explicit empty apply and never sends an unfinished column', () => {
    const applied: StudioFilter[] = [{ column: 'device_type', values: ['Mobile/Tablet'] }];
    const { onApply } = mount({ filters: applied, scopeLabel: '화면 반영 · device_type 1개 값' });
    open();
    expect(screen.getByText('적용된 조건과 같습니다')).toBeTruthy();
    expect(apply().disabled).toBe(true);
    addColumn('device_type');
    fireEvent.click(screen.getByRole('button', { name: '필터 전체 해제' }));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('keeps typed selected values distinct and never hides a saved value behind the choice limit', () => {
    const many = Array.from({ length: STUDIO_FILTER_LIMITS.values }, (_, index) => 'v' + index);
    // A saved value outside the current source choices must stay visible and uncheckable.
    expect(studioFilterOptions({ column: 'device_type', values: many }, [null])).toEqual([null, ...many.slice(0, 49)]);
    const typed: StudioFilter[] = [{ column: 'device_type', values: [1, '1', true, null] }];
    const { onApply } = mount({
      filters: typed,
      choices: [{ column: 'device_type', values: [1, '1', true, null, 'Mobile/Tablet'] }],
    });
    open();
    // Number 1 and string "1" are two different values, so both stay selectable and checked.
    expect(screen.getAllByLabelText('1')).toHaveLength(2);
    expect((screen.getAllByLabelText('1')[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByLabelText('1')[1] as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('TRUE') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('NULL') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Mobile/Tablet') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText('TRUE'));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith([{ column: 'device_type', values: [1, '1', null] }]);
  });

  it('keeps an unfinished draft while the parent re-renders and returns focus on Escape', async () => {
    const { view, onApply } = mount();
    open();
    addColumn('device_type');
    view.rerender(
      <StudioFilterPanel
        filters={[]}
        choices={choices}
        scopeLabel="화면 반영 · 공통 필터 없음"
        pendingLabel={null}
        busy={false}
        error={null}
        message={null}
        onApply={onApply}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('device_type')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: /^공통 필터/ });
    fireEvent.keyDown(screen.getByRole('region', { name: '공통 필터' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('값을 하나 이상 선택해야 적용할 수 있습니다.')).toBeNull());
    expect(document.activeElement).toBe(toggle);
  });

  it('shows the confirmed scope with a pending note and surfaces a failed query with retry', () => {
    const { onRetry } = mount({
      filters: [{ column: 'device_type', values: ['Mobile/Tablet'] }],
      scopeLabel: '화면 반영 · 공통 필터 없음',
      pendingLabel: '문서의 조건이 화면 결과에 반영되지 않았습니다.',
      error: '필터 조건으로 다시 조회하지 못했습니다.',
    });
    open();
    expect(screen.getByText('문서의 조건이 화면 결과에 반영되지 않았습니다.')).toBeTruthy();
    expect(screen.getByText('필터 조건으로 다시 조회하지 못했습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
