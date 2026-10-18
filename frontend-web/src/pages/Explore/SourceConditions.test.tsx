import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceConditions, { compile, Node, readPreview } from './SourceConditions';
import { post } from '@/helpers/apiHelper';
vi.mock('@/helpers/apiHelper', () => ({ post: vi.fn() }));
afterEach(cleanup);
const initial = {
  sourceId: 3,
  sourceRevision: 'r1',
  version: 0,
  schemaChanged: false,
  definition: { include: null, exclude: null },
  columns: [
    { name: 'amount', type: 'DOUBLE', kind: 'number' },
    { name: 'name', type: 'VARCHAR', kind: 'string' },
    { name: 'active', type: 'BOOLEAN', kind: 'boolean' },
    { name: 'day', type: 'DATE', kind: 'date' },
    { name: 'at', type: 'TIMESTAMP_NS', kind: 'timestamp' },
    { name: 'blob', type: 'BLOB', kind: 'unsupported' },
  ],
};
const response = (data: unknown) => ({
  data: { status: 'SUCCESS', data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const analysisFileRevision = 'f'.repeat(64);
const analysisPreview = (draft: any) => ({
  draft,
  population,
  analysisConditions: { sourceRevision: analysisFileRevision, definition: draft.definition },
});
const population = { total: '100', matched: '80', excluded: '10', remaining: '70', matchedRatio: 0.8, remainingRatio: 0.7 };
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const open = async () => {
  click('조건과 분석 범위');
  await screen.findByText('조건 버전 0');
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(post).mockResolvedValue(response(initial));
});
it('opens explicitly, invalidates edited preview, saves exact draft and explicitly reads persisted conditions on remount', async () => {
  const view = render(<SourceConditions sourceId={3} />);
  expect(post).not.toHaveBeenCalled();
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '12.5');
  const draft = {
    sourceId: 3,
    sourceRevision: 'r1',
    version: 0,
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [12.5] }, exclude: null },
  };
  vi.mocked(post).mockResolvedValueOnce(response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  change('포함 값 1', '13');
  expect(screen.queryByText('최종 70건 · 전체 대비 70%')).toBeNull();
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  change('포함 값 1', '12.5');
  vi.mocked(post).mockResolvedValueOnce(response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  const saved = { ...initial, version: 1, definition: draft.definition };
  vi.mocked(post).mockResolvedValueOnce(response(saved));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/save', draft);
  view.unmount();
  vi.mocked(post).mockClear();
  vi.mocked(post).mockResolvedValue(response(saved));
  render(<SourceConditions sourceId={3} />);
  expect(post).not.toHaveBeenCalled();
  click('조건과 분석 범위');
  await screen.findByText('조건 버전 1');
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('12.5');
});
it('preserves input on preview/save failures and requires confirmation before dirty reload', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '9');
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
  click('건수 미리보기');
  await screen.findByText(/입력을 보존했습니다/);
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('9');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  vi.mocked(post).mockRejectedValueOnce(new Error('offline'));
  click('확인한 조건 저장');
  await screen.findByText(/저장을 확인하지 못했습니다/);
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('9');
  const calls = vi.mocked(post).mock.calls.length;
  click('최신 조건 다시 읽기');
  expect(post).toHaveBeenCalledTimes(calls);
  click('입력 유지');
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('9');
  click('최신 조건 다시 읽기');
  click('입력을 버리고 다시 읽기');
  await waitFor(() => expect(screen.queryByLabelText('포함 값 1')).toBeNull());
});
it('edits nested OR/AND and exclusions with boolean values and NULL predicates without values', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 그룹 추가');
  change('포함 결합', 'or');
  click('포함 조건 추가');
  change('포함 1 열', 'active');
  change('포함 1 값 1', 'true');
  click('포함 그룹 추가');
  click('포함 2 조건 추가');
  change('포함 2 1 열', 'name');
  change('포함 2 1 값 1', '001');
  click('제외 조건 추가');
  change('제외 열', 'blob');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/preview', {
    sourceId: 3,
    sourceRevision: 'r1',
    version: 0,
    definition: {
      include: {
        kind: 'group',
        operator: 'or',
        children: [
          { kind: 'predicate', column: 'active', operator: 'eq', values: [true] },
          {
            kind: 'group',
            operator: 'and',
            children: [{ kind: 'predicate', column: 'name', operator: 'eq', values: ['001'] }],
          },
        ],
      },
      exclude: { kind: 'predicate', column: 'blob', operator: 'isNull' },
    },
  });
});
it('allows read-only draft preview but never save', async () => {
  render(<SourceConditions sourceId={3} canEdit={false} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '4');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it('ignores late reads after source/access change and unmount', async () => {
  let resolve: (value: any) => void;
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = render(<SourceConditions sourceId={3} />);
  click('조건과 분석 범위');
  view.rerender(<SourceConditions sourceId={4} canEdit={false} />);
  await act(async () => resolve(response(initial)));
  expect(screen.queryByText('조건 버전 0')).toBeNull();
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, sourceId: 4 }));
  await open();
  view.unmount();
});
it('rejects a preview for different input instead of enabling save', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '2');
  vi.mocked(post).mockResolvedValueOnce(response({ draft: { sourceId: 99 }, population }));
  click('건수 미리보기');
  await screen.findByText(/입력을 보존했습니다/);
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([
  ['day', '2024-02-29', true],
  ['day', '2024-02-30', false],
  ['at', '2024-01-01T00:00:00Z', true],
  ['at', '2024-01-01T00:00:00+09:00', false],
  ['amount', ' ', false],
  ['amount', 'Infinity', false],
])('validates native %s value %s before requesting preview', async (column, value, valid) => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 열', column);
  change('포함 값 1', value);
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  if (valid) {
    await screen.findByText('최종 70건 · 전체 대비 70%');
    expect(post).toHaveBeenCalledTimes(2);
  } else {
    await screen.findByRole('alert');
    expect(post).toHaveBeenCalledTimes(1);
  }
});

it('allows fresh preview/save after source revision changes and explicitly clears both trees', async () => {
  const definition = {
    include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [1] },
    exclude: { kind: 'predicate', column: 'name', operator: 'isNull' },
  };
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, sourceRevision: 'r2', schemaChanged: true, definition }));
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 삭제');
  click('제외 삭제');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) =>
    response({
      draft,
      population: { total: '0', matched: '0', excluded: '0', remaining: '0', matchedRatio: null, remainingRatio: null },
    }),
  );
  click('건수 미리보기');
  await screen.findByText('최종 0건 · 전체 대비 비율 없음');
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, sourceRevision: 'r2', version: 1 }));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/save', {
    sourceId: 3,
    sourceRevision: 'r2',
    version: 0,
    definition: { include: null, exclude: null },
  });
});
it.each(['preview', 'save'])('ignores late %s success after access identity changes', async action => {
  const view = render(<SourceConditions sourceId={3} />);
  await open();
  let finish: (value: any) => void;
  if (action === 'save') {
    vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
    click('건수 미리보기');
    await screen.findByText('최종 70건 · 전체 대비 70%');
  }
  vi.mocked(post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  click(action === 'save' ? '확인한 조건 저장' : '건수 미리보기');
  view.rerender(<SourceConditions sourceId={3} canEdit={false} />);
  await act(async () =>
    finish(
      response(
        action === 'save'
          ? { ...initial, version: 1 }
          : { draft: { sourceId: 3, sourceRevision: 'r1', version: 0, definition: initial.definition }, population },
      ),
    ),
  );
  expect(screen.queryByText('조건을 저장했습니다.')).toBeNull();
  expect(screen.queryByText('최종 70건 · 전체 대비 70%')).toBeNull();
  expect(screen.getByRole('button', { name: '조건과 분석 범위' }).getAttribute('aria-expanded')).toBe('false');
});
it('keeps exact large count strings and accepts reordered response object properties', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  vi.mocked(post).mockResolvedValueOnce(
    response({
      draft: { definition: { exclude: null, include: null }, version: 0, sourceRevision: 'r1', sourceId: 3 },
      population: { ...population, total: '9007199254740993' },
    }),
  );
  click('건수 미리보기');
  await screen.findByText('전체 9007199254740993건');
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(false);
});

it('rejects empty/oversized groups, excessive depth/nodes/values and keeps string lists native', () => {
  const leaf: Node = { kind: 'predicate', column: 'name', operator: 'in', values: ['001', '', 'a,b'] };
  const cols = initial.columns as Parameters<typeof compile>[1];
  expect(compile({ include: leaf, exclude: null }, cols).include).toEqual(leaf);
  const group = (children: Node[]): Node => ({ kind: 'group', operator: 'and', children });
  const invalid: Node[] = [
    group([]),
    group(Array(9).fill(leaf)),
    group([group([group([group([group([leaf])])])])]),
    { ...leaf, values: Array(51).fill('a') },
  ];
  invalid.forEach(include => expect(() => compile({ include, exclude: null }, cols)).toThrow());
  const sixteen = group([group(Array(7).fill(leaf)), group(Array(6).fill(leaf))]);
  expect(() => compile({ include: sixteen, exclude: group([sixteen, leaf]) }, cols)).toThrow();
});
it('removes a nested child without clearing its siblings', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 그룹 추가');
  click('포함 조건 추가');
  change('포함 1 값 1', '11');
  click('포함 조건 추가');
  change('포함 2 값 1', '22');
  click('포함 1 삭제');
  expect((screen.getByLabelText('포함 1 값 1') as HTMLInputElement).value).toBe('22');
  expect(screen.queryByLabelText('포함 2 값 1')).toBeNull();
});

it('edits separate list and between values without comma splitting or string coercion', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 연산자', 'between');
  change('포함 값 1', '1.25');
  change('포함 값 2', '9');
  click('제외 조건 추가');
  change('제외 열', 'name');
  change('제외 연산자', 'notIn');
  change('제외 값 1', 'a,b');
  click('제외 값 추가');
  change('제외 값 2', '001');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/preview', {
    sourceId: 3,
    sourceRevision: 'r1',
    version: 0,
    definition: {
      include: { kind: 'predicate', column: 'amount', operator: 'between', values: [1.25, 9] },
      exclude: { kind: 'predicate', column: 'name', operator: 'notIn', values: ['a,b', '001'] },
    },
  });
  change('포함 연산자', 'isNotNull');
  expect(screen.queryByLabelText('포함 값 1')).toBeNull();
  expect(screen.queryByText('최종 70건 · 전체 대비 70%')).toBeNull();
});
it('preserves dirty inputs when an explicitly confirmed read fails', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '7');
  click('최신 조건 다시 읽기');
  vi.mocked(post).mockRejectedValueOnce({ response: { status: 409 } });
  click('입력을 버리고 다시 읽기');
  await screen.findByRole('alert');
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('7');
  expect(screen.getByText(/미저장 변경/)).toBeTruthy();
});
it('does not expose a malformed initial response as an empty editable definition', async () => {
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, definition: {} }));
  render(<SourceConditions sourceId={3} />);
  click('조건과 분석 범위');
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '건수 미리보기' })).toBeNull();
});

it('canonicalizes UTC fractional seconds without losing nanoseconds before exact preview/save', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 열', 'at');
  change('포함 연산자', 'between');
  change('포함 값 1', '2024-01-01T00:00:00.000Z');
  change('포함 값 2', '2024-01-01T00:00:00.123456780Z');
  const draft = {
    sourceId: 3,
    sourceRevision: 'r1',
    version: 0,
    definition: {
      include: {
        kind: 'predicate',
        column: 'at',
        operator: 'between',
        values: ['2024-01-01T00:00:00Z', '2024-01-01T00:00:00.12345678Z'],
      },
      exclude: null,
    },
  };
  vi.mocked(post).mockResolvedValueOnce(response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/preview', draft);
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, version: 1, definition: draft.definition }));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/save', draft);
});
it('permits four nested groups plus a predicate and rejects a fifth group', () => {
  const leaf: Node = { kind: 'predicate', column: 'amount', operator: 'eq', values: [1] };
  const group = (child: Node): Node => ({ kind: 'group', operator: 'and', children: [child] });
  const four = group(group(group(group(leaf))));
  const cols = initial.columns as Parameters<typeof compile>[1];
  expect(compile({ include: four, exclude: null }, cols).include).toEqual(four);
  expect(() => compile({ include: group(four), exclude: null }, cols)).toThrow();
});
it.each([
  ['amount', ['9007199254740992']],
  ['amount', ['-9007199254740992']],
  ['amount', ['2', '1']],
  ['day', ['2024-02-02', '2024-02-01']],
  ['at', ['2024-01-01T00:00:00.000000002Z', '2024-01-01T00:00:00.000000001Z']],
  ['day', ['0000-01-01']],
])('rejects unsafe or unordered native %s inputs %s', (column, values) => {
  expect(() =>
    compile(
      { include: { kind: 'predicate', column, operator: values.length === 2 ? 'between' : 'eq', values }, exclude: null },
      initial.columns as Parameters<typeof compile>[1],
    ),
  ).toThrow();
});
it('accepts safe numeric endpoints and orders nanosecond ranges without Date rounding', () => {
  const cols = initial.columns as Parameters<typeof compile>[1];
  expect(
    compile(
      {
        include: {
          kind: 'predicate',
          column: 'amount',
          operator: 'between',
          values: ['-9007199254740991', '9007199254740991'],
        },
        exclude: null,
      },
      cols,
    ).include,
  ).toMatchObject({ values: [-9007199254740991, 9007199254740991] });
  expect(
    compile(
      {
        include: {
          kind: 'predicate',
          column: 'at',
          operator: 'between',
          values: ['2024-01-01T00:00:00.000000001Z', '2024-01-01T00:00:00.000000002Z'],
        },
        exclude: null,
      },
      cols,
    ).include,
  ).toMatchObject({ values: ['2024-01-01T00:00:00.000000001Z', '2024-01-01T00:00:00.000000002Z'] });
});
it('offers a leaf at the fourth nested group but disables a fifth group', async () => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 그룹 추가');
  click('포함 그룹 추가');
  click('포함 1 그룹 추가');
  click('포함 1 1 그룹 추가');
  expect((screen.getByRole('button', { name: '포함 1 1 1 조건 추가' }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: '포함 1 1 1 그룹 추가' }) as HTMLButtonElement).disabled).toBe(true);
  click('포함 1 1 1 조건 추가');
  change('포함 1 1 1 1 값 1', '5');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
});

it.each([
  ['stale version', { version: 0 }],
  ['different revision', { sourceRevision: 'r2' }],
  [
    'different definition',
    { definition: { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [99] }, exclude: null } },
  ],
])('preserves input and rejects a valid-shaped save response with %s', async (_reason, mismatch) => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '7');
  const definition = { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [7] }, exclude: null };
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, version: 1, definition, ...mismatch }));
  click('확인한 조건 저장');
  await screen.findByText(/저장을 확인하지 못했습니다/);
  expect(screen.queryByText('조건을 저장했습니다.')).toBeNull();
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('7');
  expect(screen.getByText('조건 버전 0 · 미저장 변경')).toBeTruthy();
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

it.each([
  ['TIMESTAMP_NS', '123456789', '123456789'],
  ['timestamp_ns', '123456780', '12345678'],
  ['TIMESTAMP', '123456', '123456'],
  ['TIMESTAMP', '123456000', '123456'],
  ['TIMESTAMPTZ', '000000000', ''],
  ['TIMESTAMP WITH TIME ZONE', '123450000', '12345'],
  ['TIMESTAMP_MS', '123456000', '123456'],
  ['TIMESTAMP_S', '120000000', '12'],
])('canonicalizes supported %s fraction %s without precision loss', (type, fraction, expected) => {
  const definition = compile(
    {
      include: { kind: 'predicate', column: 'at', operator: 'eq', values: [`2024-01-01T00:00:00.${fraction}Z`] },
      exclude: null,
    },
    [{ name: 'at', type, kind: 'timestamp' }],
  );
  expect(definition.include).toMatchObject({ values: [`2024-01-01T00:00:00${expected ? `.${expected}` : ''}Z`] });
});
it.each(['TIMESTAMP', 'TIMESTAMP_S', 'TIMESTAMP_MS', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE'])(
  'blocks nonzero sub-microsecond %s values before preview and preserves input',
  async type => {
    vi.mocked(post).mockResolvedValueOnce(response({ ...initial, columns: [{ name: 'at', type, kind: 'timestamp' }] }));
    render(<SourceConditions sourceId={3} />);
    await open();
    click('포함 조건 추가');
    change('포함 값 1', '2024-01-01T00:00:00.123456001Z');
    click('건수 미리보기');
    await screen.findByRole('alert');
    expect(post).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('2024-01-01T00:00:00.123456001Z');
    expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  },
);

it.each(['1.000000000000000001', '9007199254740991.1', '1e-999', '0.100000000000000001'])(
  'rejects rounded numeric text %s before preview and preserves the exact threshold',
  async value => {
    render(<SourceConditions sourceId={3} />);
    await open();
    click('포함 조건 추가');
    change('포함 값 1', value);
    click('건수 미리보기');
    await screen.findByRole('alert');
    expect(post).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe(value);
    expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  },
);
it.each([
  ['1.0', 1],
  ['01', 1],
  ['1e2', 100],
  ['0.10', 0.1],
  ['+001.2300e+2', 123],
  ['-000.000e999', -0],
])('previews exact decimal-equivalent numeric text %s as native number %s', async (value, expected) => {
  render(<SourceConditions sourceId={3} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', String(value));
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/preview', {
    sourceId: 3,
    sourceRevision: 'r1',
    version: 0,
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [expected] }, exclude: null },
  });
});

it('UC052 read grant can explicitly profile current unsaved condition without saving or altering it', async () => {
  const columns = [{ name: 'name', type: 'VARCHAR', kind: 'string' }];
  const definition = { include: { kind: 'predicate', column: 'name', operator: 'eq', values: ['A'] }, exclude: null };
  vi.mocked(post).mockImplementation(async (url, body: any) => {
    if (url.endsWith('/read')) return response({ ...initial, columns, definition });
    const { columns: selected, ...draft } = body;
    expect(selected).toEqual(['name']);
    return response({
      draft,
      population: { total: '2', matched: '1', excluded: '0', remaining: '1', matchedRatio: 0.5, remainingRatio: 0.5 },
      distributions: [
        {
          column: 'name',
          type: 'VARCHAR',
          limit: 20,
          totalGroups: '2',
          hasMore: false,
          rows: [
            { value: 'A', valueTruncated: false, total: '1', matched: '1', excluded: '0', remaining: '1' },
            { value: 'B', valueTruncated: false, total: '1', matched: '0', excluded: '0', remaining: '0' },
          ],
          other: { total: '0', matched: '0', excluded: '0', remaining: '0' },
          range: { minimum: 'A', maximum: 'B', minimumTruncated: false, maximumTruncated: false },
        },
      ],
      sample: {
        columns: [{ name: 'name', type: 'VARCHAR' }],
        rows: [{ values: ['A'], truncated: [false] }],
        limit: 20,
        totalRows: '1',
        hasMore: false,
        selection: 'ordered',
        representative: false,
      },
    });
  });
  render(<SourceConditions sourceId={3} canEdit={false} />);
  await open();
  click('분포·표본 탐색');
  fireEvent.click(screen.getByRole('checkbox', { name: 'name 분포·표본 선택' }));
  expect(post).toHaveBeenCalledTimes(1);
  click('분포·표본 조회');
  await screen.findByText(/현재 범위 전체 2행/);
  expect(post).toHaveBeenLastCalledWith(
    '/bi/source-conditions/profile',
    { sourceId: 3, sourceRevision: 'r1', version: 0, definition, columns: ['name'] },
    expect.objectContaining({ signal: expect.anything() }),
  );
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('A');
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  change('포함 값 1', 'B');
  expect(screen.queryByText(/현재 범위 전체 2행/)).toBeNull();
  expect(post).toHaveBeenCalledTimes(2);
});

it('keeps local apply optional and never invokes it during read, preview or source save', async () => {
  const onApply = vi.fn();
  const first = render(<SourceConditions sourceId={3} />);
  await open();
  expect(screen.queryByRole('button', { name: '이 분석에 조건 적용' })).toBeNull();
  first.unmount();
  render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect(onApply).not.toHaveBeenCalled();
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, version: 1 }));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
  expect(onApply).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
});
it('retains legacy preview/save without enabling apply when analysisConditions is absent', async () => {
  const onApply = vi.fn();
  render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response({ draft, population }));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(false);
  click('이 분석에 조건 적용');
  expect(onApply).not.toHaveBeenCalled();
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, version: 1 }));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
});
it.each([
  null,
  { sourceRevision: 'r1', definition: initial.definition },
  {
    sourceRevision: analysisFileRevision,
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [99] }, exclude: null },
  },
  { sourceRevision: analysisFileRevision, definition: initial.definition, sql: 'SELECT private' },
])('rejects malformed or mismatched server analysisConditions (%j)', analysisConditions => {
  const draft = { sourceId: 3, sourceRevision: 'r1', version: 0, definition: initial.definition };
  expect(() => readPreview({ draft, population, analysisConditions } as any, draft)).toThrow();
});
it('allows a reader to apply only the validated native preview snapshot without a source save', async () => {
  const onApply = vi.fn();
  render(<SourceConditions sourceId={3} canEdit={false} onApply={onApply} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '01.50');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  const calls = vi.mocked(post).mock.calls.length;
  click('이 분석에 조건 적용');
  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    sourceRevision: analysisFileRevision,
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [1.5] }, exclude: null },
  });
  expect(post).toHaveBeenCalledTimes(calls);
  expect((screen.getByRole('button', { name: '확인한 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: '이 분석에 조건 적용' }).dataset.size).toBe('default');
  expect(screen.getByText(/소스 조건 미리보기는 전체 소스 · 전체 기간 · UTC 기준/)).toBeTruthy();
  expect(screen.getByText(/현재 분석의 기간·필터·시간대 범위/)).toBeTruthy();
});
it('invalidates application immediately on edit even if the original value is restored', async () => {
  const onApply = vi.fn();
  render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '7');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  change('포함 값 1', '8');
  change('포함 값 1', '7');
  click('이 분석에 조건 적용');
  expect(onApply).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
});
it.each(['read', 'preview'])(
  'invalidates the old snapshot as soon as a new %s starts, including failed responses',
  async action => {
    const onApply = vi.fn();
    render(<SourceConditions sourceId={3} onApply={onApply} />);
    await open();
    vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
    click('건수 미리보기');
    await screen.findByText('최종 70건 · 전체 대비 70%');
    let reject!: (reason: any) => void;
    vi.mocked(post).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    click(action === 'read' ? '최신 조건 다시 읽기' : '건수 미리보기');
    expect(screen.queryByText('최종 70건 · 전체 대비 70%')).toBeNull();
    click('이 분석에 조건 적용');
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => reject(new Error('offline')));
    await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
  },
);
it('cannot restore an old preview after input changes while its response is late', async () => {
  const onApply = vi.fn();
  render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '7');
  let resolve!: (value: any) => void;
  let original: any;
  vi.mocked(post).mockImplementationOnce((_url, draft) => {
    original = draft;
    return new Promise(done => {
      resolve = done;
    });
  });
  click('건수 미리보기');
  // Model a queued input event; a retired request must not reinstate its earlier validated snapshot.
  change('포함 값 1', '8');
  await act(async () => resolve(response(analysisPreview(original))));
  expect(screen.queryByText('최종 70건 · 전체 대비 70%')).toBeNull();
  expect((screen.getByRole('button', { name: '이 분석에 조건 적용' }) as HTMLButtonElement).disabled).toBe(true);
  click('이 분석에 조건 적용');
  expect(onApply).not.toHaveBeenCalled();
  expect((screen.getByLabelText('포함 값 1') as HTMLInputElement).value).toBe('8');
});
it('never applies a mismatched preview or a preview retired by a source switch', async () => {
  const onApply = vi.fn();
  const view = render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  vi.mocked(post).mockImplementationOnce(async (_url, draft: any) =>
    response({ draft: { ...draft, sourceRevision: 'wrong' }, population }),
  );
  click('건수 미리보기');
  await screen.findByRole('alert');
  click('이 분석에 조건 적용');
  expect(onApply).not.toHaveBeenCalled();
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  view.rerender(<SourceConditions sourceId={4} onApply={onApply} />);
  expect(screen.queryByRole('button', { name: '이 분석에 조건 적용' })).toBeNull();
  expect(onApply).not.toHaveBeenCalled();
});
it('provides an independent definition clone so a consumer cannot mutate the validated save basis', async () => {
  const onApply = vi.fn((snapshot: any) => {
    snapshot.definition.include.values[0] = 999;
  });
  render(<SourceConditions sourceId={3} onApply={onApply} />);
  await open();
  click('포함 조건 추가');
  change('포함 값 1', '7');
  vi.mocked(post).mockImplementationOnce(async (_url, draft) => response(analysisPreview(draft)));
  click('건수 미리보기');
  await screen.findByText('최종 70건 · 전체 대비 70%');
  const previewDraft = vi.mocked(post).mock.calls[1][1] as any;
  click('이 분석에 조건 적용');
  expect(previewDraft.definition.include.values).toEqual([7]);
  vi.mocked(post).mockResolvedValueOnce(response({ ...initial, version: 1, definition: previewDraft.definition }));
  click('확인한 조건 저장');
  await screen.findByText('조건을 저장했습니다.');
  expect(post).toHaveBeenLastCalledWith('/bi/source-conditions/save', previewDraft);
});
