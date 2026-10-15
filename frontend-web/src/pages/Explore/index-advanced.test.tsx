import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Explore from './index';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), metrics: [] as any[] }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => api.navigate,
  useSearchParams: () => [new URLSearchParams('sourceId=1')],
}));
vi.mock('./FileVersions', async () => {
  const { useState } = await import('react');
  return {
    default: ({ onChanged, disabled }: any) => {
      const [notice, setNotice] = useState('');
      return (
        <div>
          <button
            disabled={disabled}
            onClick={() => {
              setNotice('파일 복원 완료');
              onChanged();
            }}
          >
            버전 복원 검증
          </button>
          <p>{notice}</p>
        </div>
      );
    },
  };
});
vi.mock('@/widget/modules/board/NumericBoard', () => ({ default: () => <div>숫자 미리보기</div> }));
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const base = {
  schemaVersion: 1,
  sourceId: 1,
  unit: '%',
  decimalPlaces: 2,
  numberNotation: 'plain',
  column: 'amount',
};
const weighted = { ...base, label: '가중 매출', aggregation: 'WEIGHTED_AVG', weightColumn: 'weight' };
const ratio = { ...base, label: '전환 비율', aggregation: 'RATIO_SUM', denominatorColumn: 'total', scale: 100 };
const metric = (definition: any, id = 10) => ({ id, label: definition.label, definitionVersion: 1, definition });
const profile = {
  sourceId: 1,
  name: '파일',
  supported: true,
  status: 'ready',
  rowCount: '5',
  dataVersion: 'a'.repeat(64),
  columns: ['amount', 'weight', 'total', 'category'].map(name => ({
    name,
    type: name === 'category' ? 'VARCHAR' : 'DOUBLE',
    numeric: name !== 'category',
    temporal: false,
    nullCount: '0',
  })),
};
beforeEach(() => {
  vi.resetAllMocks();
  api.metrics = [metric(weighted), metric(ratio, 11)];
  api.get.mockImplementation(async (url: string) =>
    success(
      url.endsWith('/profile') ? profile : url === '/bi/metrics' ? api.metrics : [{ id: 1, name: '파일', engine: 'duckdb' }],
    ),
  );
  api.post.mockImplementation(async (url: string, body: any) =>
    success(
      url === '/bi/metrics'
        ? metric(body, 20)
        : {
            rows: [{ value: '12.34' }],
            metric: api.metrics.find(saved => saved.id === body.metricId).definition,
            sourceRevision: profile.dataVersion,
            definitionVersion: 1,
            complete: true,
          },
    ),
  );
});
afterEach(cleanup);
const mount = async () => {
  render(<Explore />);
  await screen.findByLabelText('지표 이름');
};
const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const disabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: '지표 저장' }));
  await waitFor(() => expect(value('저장된 지표')).toBe('20'));
  return api.post.mock.calls.find(([url]) => url === '/bi/metrics')[1];
};

it('keeps source selection available while loading and ignores a superseded profile', async () => {
  const deferred = () => {
    let resolve!: (value: unknown) => void;
    const promise = new Promise(result => {
      resolve = result;
    });
    return { promise, resolve };
  };
  const second = deferred();
  const third = deferred();
  api.get.mockImplementation(async (url: string) => {
    if (url === '/bi/sources/2/profile') return second.promise;
    if (url === '/bi/sources/3/profile') return third.promise;
    if (url.endsWith('/profile')) return success(profile);
    if (url === '/bi/metrics') return success(api.metrics);
    return success([1, 2, 3].map(id => ({ id, name: `파일${id}`, engine: 'duckdb' })));
  });
  await mount();
  const source = screen.getByLabelText('데이터 소스') as HTMLSelectElement;
  source.focus();
  choose('데이터 소스', '2');
  await screen.findByText('데이터 불러오는 중…');
  expect(source.disabled).toBe(false);
  expect(document.activeElement).toBe(source);
  choose('데이터 소스', '3');
  third.resolve(success({ ...profile, sourceId: 3, rowCount: '33' }));
  await screen.findByText(/저장된 전체 행 수: 33/);
  await act(async () => second.resolve(success({ ...profile, sourceId: 2, rowCount: '22' })));
  expect(value('데이터 소스')).toBe('3');
  expect(screen.getByText(/저장된 전체 행 수: 33/)).not.toBeNull();
  expect(screen.queryByText(/저장된 전체 행 수: 22/)).toBeNull();
  expect(document.activeElement).toBe(source);
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  ['10', weighted, '가중치 열', 'weight'],
  ['11', ratio, '분모 열', 'total'],
])('preserves saved advanced request fields after reloading metric %s', async (id, definition, secondary, selected) => {
  await mount();
  choose('저장된 지표', id as string);
  expect(value(secondary as string)).toBe(selected);
  choose('지표 이름', '다른 지표 이름');
  expect(value('저장된 지표')).toBe('');
  expect(disabled('지표 저장')).toBe(false);
  expect(await save()).toEqual({ ...(definition as object), label: '다른 지표 이름' });
});

it('selects and reloads formulas, labels, scale and NULL semantics', async () => {
  await mount();
  choose('집계 방법', 'WEIGHTED_AVG');
  expect(screen.getByLabelText('값 열')).not.toBeNull();
  expect(screen.getByLabelText('가중치 열')).not.toBeNull();
  expect(screen.getByText(/SUM\(값 × 가중치\) \/ SUM\(가중치\)/).textContent).toMatch(/음수 가중치.*값 없음/);
  expect(screen.getByText(/둘 중 하나라도 빈 값/).textContent).toContain('해당 행을 제외');
  choose('집계 방법', 'RATIO_SUM');
  expect(value('결과 배율')).toBe('1');
  expect(screen.getByText(/SUM\(분자\) \/ SUM\(분모\) × 1/).textContent).toContain('각각 자신의 빈 값(NULL)을 제외');
  expect(screen.getByText(/분모 합계가 0/).textContent).toContain('어느 한쪽에 값이 없으면');
  expect(within(screen.getByLabelText('결과 배율')).getByRole('option', { name: '100 (백분율)' })).not.toBeNull();
  choose('저장된 지표', '11');
  expect(value('분자 열')).toBe('amount');
  expect(value('분모 열')).toBe('total');
  expect(value('결과 배율')).toBe('100');
  expect(screen.getByText(/SUM\(분자\) \/ SUM\(분모\) × 100/)).not.toBeNull();
  choose('저장된 지표', '10');
  expect(value('값 열')).toBe('amount');
  expect(value('가중치 열')).toBe('weight');
  expect(screen.queryByLabelText('결과 배율')).toBeNull();
});

it.each([
  { ...weighted, column: 'category' },
  { ...weighted, weightColumn: 'category' },
  { ...weighted, weightColumn: undefined },
  { ...ratio, column: 'category' },
  { ...ratio, denominatorColumn: 'category' },
  { ...ratio, denominatorColumn: undefined },
])('gates saving and preview for invalid numeric fields: %j', async definition => {
  api.metrics = [metric(definition)];
  await mount();
  choose('차트 제목', '숫자');
  choose('저장된 지표', '10');
  expect(disabled('결과 미리보기')).toBe(true);
  const primary = definition.aggregation === 'WEIGHTED_AVG' ? '값 열' : '분자 열';
  const secondary = definition.aggregation === 'WEIGHTED_AVG' ? '가중치 열' : '분모 열';
  for (const label of [primary, secondary]) {
    expect(within(screen.getByLabelText(label)).queryByRole('option', { name: 'category' })).toBeNull();
  }
  choose('지표 이름', '수정');
  expect(disabled('지표 저장')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '지표 저장' }));
  expect(api.post).not.toHaveBeenCalled();
  choose(primary, 'amount');
  choose(secondary, 'total');
  expect(disabled('지표 저장')).toBe(false);
});

it.each([
  ['10', '값 열', 'total'],
  ['10', '가중치 열', 'total'],
  ['11', '분자 열', 'weight'],
  ['11', '분모 열', 'weight'],
  ['11', '결과 배율', '1'],
])('invalidates selected metric and preview when %s changes %s', async (id, label, next) => {
  await mount();
  choose('저장된 지표', id);
  choose('차트 제목', '숫자');
  fireEvent.click(screen.getByRole('button', { name: '결과 미리보기' }));
  await screen.findByRole('cell', { name: '12.34 %' });
  expect(disabled('대시보드 저장')).toBe(false);
  choose(label, next);
  expect(value('저장된 지표')).toBe('');
  expect(screen.queryByRole('cell', { name: '12.34 %' })).toBeNull();
  expect(disabled('결과 미리보기')).toBe(true);
  expect(disabled('대시보드 저장')).toBe(true);
});

it('clears secondary fields on aggregation changes and sends fresh ratio fields', async () => {
  await mount();
  choose('저장된 지표', '10');
  choose('집계 방법', 'RATIO_SUM');
  expect(value('저장된 지표')).toBe('');
  expect(value('분자 열')).toBe('');
  expect(value('분모 열')).toBe('');
  expect(value('결과 배율')).toBe('1');
  expect(disabled('지표 저장')).toBe(true);
  choose('분자 열', 'amount');
  choose('분모 열', 'total');
  choose('결과 배율', '100');
  const body = await save();
  expect(body).toMatchObject({ aggregation: 'RATIO_SUM', column: 'amount', denominatorColumn: 'total', scale: 100 });
  expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('weightColumn');
  api.post.mockClear();
  choose('집계 방법', 'SUM');
  choose('집계할 열', 'amount');
  const sum = JSON.parse(JSON.stringify(await save()));
  expect(sum).not.toHaveProperty('weightColumn');
  expect(sum).not.toHaveProperty('denominatorColumn');
  expect(sum).not.toHaveProperty('scale');
});

it('renders the server rejection as text and falls back for non-string errors', async () => {
  await mount();
  choose('저장된 지표', '10');
  choose('지표 이름', '수정');
  const message = '가중치 오류 <img src=x onerror=alert(1)>';
  api.post.mockRejectedValueOnce({ response: { data: { data: message } } });
  fireEvent.click(screen.getByRole('button', { name: '지표 저장' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(message);
  expect(alert.querySelector('img')).toBeNull();
  expect(value('가중치 열')).toBe('weight');
  api.post.mockRejectedValueOnce({ response: { data: { data: { message: 'invalid' } } } });
  fireEvent.click(screen.getByRole('button', { name: '지표 저장' }));
  await screen.findByText('지표를 저장하지 못했습니다. 아래 지표 저장 버튼으로 다시 시도해 주세요.');
});

it('keeps file completion feedback mounted during same-source profile refresh', async () => {
  let resolveProfile: (value: unknown) => void;
  const refreshed = new Promise(resolve => {
    resolveProfile = resolve;
  });
  let profileCalls = 0;
  const duckdbProfile = { ...profile, engine: 'duckdb' };
  api.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/profile')) {
      profileCalls += 1;
      return profileCalls === 1 ? success(duckdbProfile) : refreshed;
    }
    return success(url === '/bi/metrics' ? api.metrics : [{ id: 1, name: '파일', engine: 'duckdb' }]);
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '버전 복원 검증' }));
  await waitFor(() => expect(profileCalls).toBe(2));
  expect(screen.getByText('파일 복원 완료')).not.toBeNull();
  await act(async () => resolveProfile(success({ ...duckdbProfile, dataVersion: 'b'.repeat(64) })));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '버전 복원 검증' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect(screen.getByText('파일 복원 완료')).not.toBeNull();
});

it('clears the retained profile when same-source refresh fails', async () => {
  let profileCalls = 0;
  api.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/profile')) {
      profileCalls += 1;
      if (profileCalls > 1) throw new Error('profile unavailable');
      return success({ ...profile, engine: 'duckdb' });
    }
    return success(url === '/bi/metrics' ? api.metrics : [{ id: 1, name: '파일', engine: 'duckdb' }]);
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '버전 복원 검증' }));
  await screen.findByText('데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
  expect(screen.queryByRole('button', { name: '버전 복원 검증' })).toBeNull();
  expect(screen.queryByLabelText('지표 이름')).toBeNull();
});
