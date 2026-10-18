import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CalculatedMetricBuilder from './CalculatedMetricBuilder';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
const props = {
  sourceId: 4,
  sourceRevision: 'v4',
  disabled: false,
  onCreated: vi.fn(),
  metrics: [
    { id: 1, label: '매출', definitionVersion: 2, definition: { aggregation: 'SUM' } },
    { id: 2, label: '비용', definitionVersion: 1, definition: { aggregation: 'SUM' } },
  ],
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const fillMargin = () => {
  fireEvent.change(screen.getByLabelText('계산 지표 이름'), { target: { value: '계산 마진' } });
  fireEvent.change(screen.getByLabelText('계산 방식'), { target: { value: 'margin' } });
  fireEvent.change(screen.getByLabelText('지표 A'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('지표 B'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('분모 지표 C'), { target: { value: '1' } });
};
it('previews a bounded reference tree without sending SQL or trusted operand definitions, and saves only explicitly', async () => {
  const saved = { id: 3, definition: { aggregation: 'FORMULA' } };
  api.post
    .mockResolvedValueOnce({
      data: {
        status: 'SUCCESS',
        data: { sourceRevision: 'v4', definition: { unit: '%', decimalPlaces: 2 }, rows: [{ value: 17.79 }] },
      },
    })
    .mockResolvedValueOnce({ data: { status: 'SUCCESS', data: saved } });
  render(<CalculatedMetricBuilder {...props} />);
  fillMargin();
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '계산 지표 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '계산 미리보기' }));
  await screen.findByText('17.79%');
  const body = api.post.mock.calls[0][1];
  expect(body.expression).toEqual({
    op: 'ratio',
    left: { op: 'subtract', left: { metricId: 1, definitionVersion: 2 }, right: { metricId: 2, definitionVersion: 1 } },
    right: { metricId: 1, definitionVersion: 2 },
    scale: 100,
  });
  expect(JSON.stringify(body)).not.toMatch(/sql|operands|SUM/);
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '계산 지표 저장' }));
  await act(async () => undefined);
  expect(props.onCreated).toHaveBeenCalledWith(saved);
});
it('drops a late preview after the source version changes and cannot save it', async () => {
  let finish: (value: unknown) => void = () => undefined;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const view = render(<CalculatedMetricBuilder {...props} />);
  fillMargin();
  fireEvent.click(screen.getByRole('button', { name: '계산 미리보기' }));
  const signal = api.post.mock.calls[0][2].signal as AbortSignal;
  view.rerender(<CalculatedMetricBuilder {...props} sourceRevision="v5" />);
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish({
      data: {
        status: 'SUCCESS',
        data: { sourceRevision: 'v4', definition: { unit: '%', decimalPlaces: 2 }, rows: [{ value: 17.79 }] },
      },
    });
  });
  expect(screen.queryByText('17.79%')).toBeNull();
  expect((screen.getByRole('button', { name: '계산 지표 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
