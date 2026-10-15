import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import MetricTrend from './MetricTrend';
import { PreviousPeriodData } from './PeriodComparison';
import type { MetricTrendData } from './trendGeometry';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
// 실제 설치는 인라인 style 대신 Tailwind 클래스로 44px 최소 터치 영역과 줄바꿈을 표현한다.
const classesOf = (element: Element) => element.className.split(' ');
const title = '매출 · 이전 기간';
const times = ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2026-01-11T00:00:00Z'];
const trend = (): MetricTrendData => ({
  column: 'event_time',
  grain: 'day',
  points: times.map((time, index) => ({ time, value: [0, null, 4][index] })),
  contribution: { supported: true, groupFingerprint: 'previous-groups' },
});
const svg = () => screen.getByRole('group', { name: `${title} 일별 추세` });
const activeAction = () => within(screen.getByText(/집계 원본 시점:/).parentElement).getByRole('button');
const bound = (element: Element, left: number, width: number, height: number) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left,
    top: 0,
    width,
    height,
    right: left + width,
    bottom: height,
    x: left,
    y: 0,
    toJSON: () => ({}),
  });
const hover = (element: Element, clientX: number) =>
  fireEvent(element, new MouseEvent('pointermove', { bubbles: true, clientX }));
const tableProps = { title: '추세', categoryField: 'bucket', valueField: 'amount' };
const previousLabel = (category: unknown) =>
  `이전 기간 시점 원본 행 보기: 추세 · ${
    category === null
      ? '값 없음 (NULL)'
      : `${String(category)} (${
          typeof category === 'number' ? '숫자' : typeof category === 'boolean' ? '불리언' : '문자열'
        })`
  }`;
const previousTable = () => {
  userEvent.click(screen.getByLabelText('추세 이전 기간 데이터 표'));
  return screen.getByRole('table');
};

it.each([
  { left: 80, width: 300, height: 30, last: 380 },
  { left: 100, width: 900, height: 60, last: 846 },
])(
  'hovers and clicks contributor-only previous KPI points without implicit drill-through, using actual SVG distances %j',
  rect => {
    const contribute = vi.fn();
    render(<MetricTrend trend={trend()} title={title} onContributionSelect={contribute} />);
    bound(svg(), rect.left, rect.width, rect.height);
    hover(svg(), rect.last);
    expect(activeAction().getAttribute('aria-label')).toContain('2026-01-11 00:00:00 UTC');
    expect(contribute).not.toHaveBeenCalled();
    fireEvent.click(svg(), { clientX: rect.left });
    expect(activeAction().getAttribute('aria-label')).toContain('2026-01-01 00:00:00 UTC');
    expect(contribute).not.toHaveBeenCalled();
    userEvent.click(activeAction());
    expect(contribute).toHaveBeenCalledExactlyOnceWith(times[0]);
    expect(screen.queryByText(/기간 필터링/)).toBeNull();
    expect(screen.queryByRole('button', { name: /기간 선택:/ })).toBeNull();
  },
);

it('keeps NULL points keyboard/table accessible while numerical pointer selection skips them', async () => {
  const contribute = vi.fn();
  render(<MetricTrend trend={trend()} title={title} onContributionSelect={contribute} />);
  bound(svg(), 0, 600, 60);
  hover(svg(), 63.2);
  expect(activeAction().getAttribute('aria-label')).toContain('2026-01-01');
  svg().focus();
  await userEvent.keyboard('{ArrowRight}{Enter} ');
  expect(screen.getByText(/집계 원본 시점:/).textContent).toContain('2026-01-02 00:00:00 UTC · 값 없음');
  expect(contribute).not.toHaveBeenCalled();
  await userEvent.tab();
  expect(document.activeElement).toBe(activeAction());
  await userEvent.keyboard('{Enter}');
  expect(contribute).toHaveBeenCalledExactlyOnceWith(times[1]);
  userEvent.click(screen.getByLabelText(`${title} 시계열 데이터 표`));
  const tableAction = within(screen.getByRole('table')).getByRole('button', { name: /2026-01-02/ });
  expect(within(tableAction.closest('tr')).getByText('값 없음')).toBeTruthy();
});

it('guards contributor-only hover/click/button while pending and resumes with the latest callback', () => {
  const oldCallback = vi.fn(),
    callback = vi.fn();
  const view = render(<MetricTrend trend={trend()} title={title} onContributionSelect={oldCallback} />);
  bound(svg(), 0, 600, 60);
  const button = activeAction() as HTMLButtonElement;
  act(() => button.focus());
  view.rerender(
    <MetricTrend
      trend={trend()}
      title={title}
      onContributionSelect={callback}
      contributionDisabled
      contributionDisabledReason="이전 기간을 조회 중입니다."
    />,
  );
  hover(svg(), 596);
  fireEvent.click(svg(), { clientX: 596 });
  expect(activeAction()).toBe(button);
  expect(button.getAttribute('aria-label')).toContain('2026-01-01');
  expect(document.activeElement).toBe(button);
  expect(button.disabled).toBe(false);
  userEvent.click(button);
  expect(oldCallback).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
  view.rerender(<MetricTrend trend={trend()} title={title} onContributionSelect={callback} />);
  fireEvent.click(svg(), { clientX: 596 });
  userEvent.click(activeAction());
  expect(callback).toHaveBeenCalledExactlyOnceWith(times[2]);
});

it('does not introduce pointer actions when current time-filter metadata is unproven', () => {
  const filter = vi.fn(),
    contribute = vi.fn();
  render(<MetricTrend trend={trend()} title={title} onTimeSelect={filter} onContributionSelect={contribute} />);
  bound(svg(), 0, 600, 60);
  hover(svg(), 596);
  fireEvent.click(svg(), { clientX: 596 });
  expect(activeAction().getAttribute('aria-label')).toContain('2026-01-01');
  expect(filter).not.toHaveBeenCalled();
  expect(contribute).not.toHaveBeenCalled();
});

it('adds a separate native third-column action per raw typed previous group without guessing dates', () => {
  const contribute = vi.fn();
  const categories = [null, 'null', 1, '1', false, times[1], '<img onerror=attack>'];
  render(
    <PreviousPeriodData
      {...tableProps}
      onContributionSelect={contribute}
      data={categories.map(bucket => ({ bucket, amount: null }))}
    />,
  );
  const table = previousTable();
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map(cell => cell.textContent),
  ).toEqual(['bucket', 'amount', '집계 원본 행']);
  categories.forEach(category => {
    const button = within(table).getByRole('button', { name: previousLabel(category) });
    expect(button.tagName).toBe('BUTTON');
    // min-h-11 / min-w-11 = Tailwind 2.75rem = 44px 최소 터치 영역
    expect(classesOf(button)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'whitespace-normal']));
    userEvent.click(button);
  });
  expect(contribute.mock.calls).toEqual(categories.map(category => [category]));
  expect(table.querySelector('img')).toBeNull();
  expect(classesOf(screen.getByRole('region', { name: '추세 이전 기간 값' }))).toContain('overflow-auto');
});

it('keeps native previous-table Enter/Space actions guarded and focusable during pending with a linked reason', async () => {
  const oldCallback = vi.fn(),
    callback = vi.fn();
  const data = [
    { bucket: times[0], amount: 0 },
    { bucket: null, amount: null },
  ];
  const view = render(<PreviousPeriodData {...tableProps} data={data} onContributionSelect={oldCallback} />);
  const table = previousTable();
  const button = within(table).getByRole('button', { name: previousLabel(times[0]) }) as HTMLButtonElement;
  button.focus();
  view.rerender(
    <PreviousPeriodData
      {...tableProps}
      data={data}
      onContributionSelect={callback}
      contributionDisabled
      contributionDisabledReason="이전 기간 조회가 완료된 뒤 확인할 수 있습니다."
    />,
  );
  expect(document.activeElement).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(document.getElementById(button.getAttribute('aria-describedby')).textContent).toBe(
    '이전 기간 조회가 완료된 뒤 확인할 수 있습니다.',
  );
  await userEvent.keyboard('{Enter} ');
  fireEvent.click(button);
  await userEvent.tab();
  expect(document.activeElement).toBe(within(table).getByRole('button', { name: previousLabel(null) }));
  await userEvent.keyboard('{Enter}');
  expect(callback).not.toHaveBeenCalled();
  expect(oldCallback).not.toHaveBeenCalled();
  view.rerender(<PreviousPeriodData {...tableProps} data={data} onContributionSelect={callback} />);
  await userEvent.keyboard('{Enter} ');
  expect(callback.mock.calls).toEqual([[null], [null]]);
  expect(screen.queryByText('이전 기간 조회가 완료된 뒤 확인할 수 있습니다.')).toBeNull();
});

it('omits actions for missing, inherited or nonprimitive raw categories', () => {
  const contribute = vi.fn();
  render(
    <PreviousPeriodData
      {...tableProps}
      onContributionSelect={contribute}
      data={[{}, { bucket: undefined }, { bucket: {} }, { bucket: NaN }, Object.create({ bucket: times[0] })]}
    />,
  );
  previousTable();
  expect(screen.queryByRole('button')).toBeNull();
  expect(contribute).not.toHaveBeenCalled();
});

it('retains the original two-column table without a callback and removes stale actions when callback is removed', () => {
  const contribute = vi.fn();
  const data = [{ bucket: times[0], amount: 0 }];
  const view = render(<PreviousPeriodData {...tableProps} data={data} onContributionSelect={contribute} />);
  const table = previousTable();
  expect(within(table).getByRole('button')).toBeTruthy();
  view.rerender(<PreviousPeriodData {...tableProps} data={data} />);
  expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
  expect(screen.queryByRole('button')).toBeNull();
  expect(within(table).getByText(times[0])).toBeTruthy();
});
