import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StudioDateRangePanel, {
  studioDateDraftReview,
  studioDateDraftStatus,
  studioDateRangeDraft,
  StudioDateRangePanelProps,
} from './StudioDateRangePanel';
import { validateStudioDateRange } from './studioDocument';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const columns = [{ column: 'created_at', min: '2024-01-01', max: '2024-02-29' }];
const mount = (over: Partial<StudioDateRangePanelProps> = {}) => {
  const onApply = vi.fn();
  const view = render(<StudioDateRangePanel columns={columns} onApply={onApply} {...over} />);
  return { onApply, view };
};
const open = () => fireEvent.click(screen.getByRole('button', { name: /^공통 기간/ }));
const apply = () => screen.getByRole('button', { name: '적용' }) as HTMLButtonElement;
const setDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Studio common date range panel', () => {
  it('reads an exclusive instant bound as the days it covers and warns before replacing it', () => {
    const { onApply } = mount({
      dateRange: {
        column: 'created_at',
        start: '2024-01-01T00:00:00Z',
        end: '2024-02-01T00:00:00Z',
        precision: 'timestamp',
        timeZone: 'Asia/Seoul',
      },
    });
    expect(
      studioDateRangeDraft({
        column: 'created_at',
        start: '2024-01-01T00:00:00Z',
        end: '2024-02-01T00:00:00Z',
        precision: 'timestamp',
      }),
    ).toEqual({ column: 'created_at', start: '2024-01-01', end: '2024-01-31' });
    open();
    expect(screen.getByText(/초 단위 정밀 범위/)).toBeTruthy();
    expect(screen.getByText(/Asia\/Seoul 기준입니다/)).toBeTruthy();
    expect((screen.getByLabelText('종료일 (UTC)') as HTMLInputElement).value).toBe('2024-01-31');
    expect(apply().disabled).toBe(true);
    setDate('종료일 (UTC)', '2024-02-15');
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ column: 'created_at', start: '2024-01-01', end: '2024-02-15' });
  });

  it('blocks apply while the range is incomplete or reversed and explains why', () => {
    const { onApply } = mount();
    open();
    fireEvent.change(screen.getByLabelText('기간 열'), { target: { value: 'created_at' } });
    setDate('시작일 (UTC)', '2024-03-01');
    expect(screen.getByText(/열·시작일·종료일을 모두 입력해야/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
    setDate('종료일 (UTC)', '2024-02-01');
    expect(screen.getByText(/시작일이 종료일보다 늦을 수 없습니다/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
    setDate('종료일 (UTC)', '2024-03-31');
    expect(apply().disabled).toBe(false);
  });

  it('refuses an impossible calendar day instead of sending it, and reports it on a forced attempt', () => {
    mount();
    open();
    fireEvent.change(screen.getByLabelText('기간 열'), { target: { value: 'created_at' } });
    // The protocol validator decides readiness, so a rollover day never reaches the document.
    expect(studioDateDraftStatus({ column: 'created_at', start: '2024-02-31', end: '2024-03-05' })).toBe('invalid');
    expect(studioDateDraftStatus({ column: 'created_at', start: '0000-01-01', end: '2024-01-01' })).toBe('invalid');
    expect(studioDateDraftStatus({ column: 'created_at', start: '2024-01-01', end: '9999-12-31' })).toBe('invalid');
    expect(studioDateDraftReview({ column: 'created_at', start: '2024-01-01', end: '9999-12-31' }).message).toMatch(
      /지원 범위/,
    );
    expect(studioDateDraftStatus({ column: 'created_at', start: '2024-01-01', end: '2024-01-31' })).toBe('ready');
    expect(() => validateStudioDateRange({ column: 'created_at', start: '2024-01-01', end: '9999-12-31' })).toThrow(
      /지원 범위/,
    );
    setDate('시작일 (UTC)', '2024-01-01');
    setDate('종료일 (UTC)', '2024-12-31');
    expect(apply().disabled).toBe(false);
    // A day the input accepts but the protocol refuses (no representable day after it) stays blocked.
    setDate('종료일 (UTC)', '9999-12-31');
    expect(screen.getByText(/지원 범위를 벗어났습니다/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
  });

  it('applies nothing until the explicit action and clears the period with one reset', () => {
    const { onApply } = mount({ dateRange: { column: 'created_at', start: '2024-01-01', end: '2024-01-31' } });
    open();
    expect(screen.getByText('적용된 기간과 같습니다')).toBeTruthy();
    expect(apply().disabled).toBe(true);
    setDate('시작일 (UTC)', '2024-01-02');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '기간 전체 해제' }));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('keeps an unfinished draft across a parent re-render and returns focus on Escape', async () => {
    const { view, onApply } = mount();
    open();
    fireEvent.change(screen.getByLabelText('기간 열'), { target: { value: 'created_at' } });
    view.rerender(<StudioDateRangePanel columns={columns} onApply={onApply} />);
    expect((screen.getByLabelText('기간 열') as HTMLSelectElement).value).toBe('created_at');
    const toggle = screen.getByRole('button', { name: /^공통 기간/ });
    fireEvent.keyDown(screen.getByRole('region', { name: '공통 기간' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('기간 열')).toBeNull());
    expect(document.activeElement).toBe(toggle);
  });

  it('shows the whole period when nothing is applied and disables apply and clear', () => {
    mount();
    expect(screen.getByText('전체 기간')).toBeTruthy();
    open();
    expect(apply().disabled).toBe(true);
    expect(screen.getByRole('button', { name: '기간 전체 해제' }).hasAttribute('disabled')).toBe(true);
  });
});
