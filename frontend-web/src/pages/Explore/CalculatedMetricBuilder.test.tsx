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

const selfRatioMessage =
  '분자와 분모가 같은 계산은 비율을 비교할 수 없습니다. 서로 다른 계산을 선택해 주세요. 입력은 유지했습니다.';
const genericMessage = '계산 지표를 처리하지 못했습니다. 같은 단위의 지표와 계산 조건을 확인해 주세요. 입력은 유지했습니다.';
it.each([
  ['direct', 400, { code: 'FORMULA_SELF_RATIO' }, selfRatioMessage],
  ['wrapped', 400, { data: { code: 'FORMULA_SELF_RATIO' } }, selfRatioMessage],
  ['unknown', 400, { code: 'UNKNOWN_CODE' }, genericMessage],
  ['wrong status', 500, { code: 'FORMULA_SELF_RATIO' }, genericMessage],
])('maps %s errors safely and preserves the formula inputs', async (_kind, status, detail, expected) => {
  api.post.mockRejectedValueOnce({
    response: { status, data: { ...detail, message: 'SELECT private_password FROM private_table', sql: 'private SQL' } },
  });
  render(<CalculatedMetricBuilder {...props} />);
  fillMargin();
  fireEvent.change(screen.getByLabelText('계산 방식'), { target: { value: 'ratio' } });
  fireEvent.change(screen.getByLabelText('지표 B'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '계산 미리보기' }));
  await screen.findByText(expected);
  expect((screen.getByLabelText('계산 지표 이름') as HTMLInputElement).value).toBe('계산 마진');
  expect((screen.getByLabelText('계산 방식') as HTMLSelectElement).value).toBe('ratio');
  expect((screen.getByLabelText('지표 A') as HTMLSelectElement).value).toBe('1');
  expect((screen.getByLabelText('지표 B') as HTMLSelectElement).value).toBe('1');
  expect((screen.getByRole('button', { name: '계산 지표 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText(/SELECT|private/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '계산 지표 저장' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(props.onCreated).not.toHaveBeenCalled();
});
