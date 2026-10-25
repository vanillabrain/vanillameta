import { describe, it, expect } from 'vitest';
import { CHART_SETUP_UNAVAILABLE_MESSAGE, creationError, validateCreationProposal } from './studioCreation';
const base = () => ({
  proposalId: 'p1',
  sourceId: 4,
  sourceRevision: 'a'.repeat(64),
  title: '매출',
  profile: { sourceId: 4, rowCount: '2', columns: [{ name: 'amount', type: 'BIGINT' }] },
  semanticProposal: [
    { title: '총매출', kind: 'BOARD_NUMERIC', metric: { label: '총매출', aggregation: 'SUM', column: 'amount' } },
  ],
  preview: {
    draft: {
      databaseId: 4,
      title: '매출',
      explanation: '',
      widgets: [
        {
          type: 'BOARD_NUMERIC',
          title: '총매출',
          description: '',
          sql: 'SELECT sum(amount) AS value FROM source',
          valueField: 'value',
        },
      ],
    },
    widgets: [
      {
        type: 'BOARD_NUMERIC',
        sql: 'SELECT sum(amount) AS value FROM source',
        valueField: 'value',
        fields: [],
        datas: [{ value: 500 }],
      },
    ],
  },
});
describe('Studio creation boundary', () => {
  it('explains self-ratio refusal without exposing server detail text', () => {
    for (const body of [
      { code: 'FORMULA_SELF_RATIO', message: 'private detail' },
      { data: { code: 'FORMULA_SELF_RATIO', message: 'private detail' } },
    ]) {
      const message = creationError({ response: { status: 400, data: body } });
      expect(message).toContain('분자와 분모가 같은 계산');
      expect(message).toContain('기존 지표와 입력은 유지');
      expect(message).not.toContain('private detail');
    }
  });
  it('accepts a server-calculated semantic proposal for the selected source', () => {
    expect(validateCreationProposal(base(), 4).preview?.widgets[0].datas).toEqual([{ value: 500 }]);
  });
  it('rejects source mismatch and malformed dimensions before rendering', () => {
    expect(() => validateCreationProposal(base(), 9)).toThrow();
    const bad: any = base();
    bad.semanticProposal[0].dimension = { column: 'amount' };
    expect(() => validateCreationProposal(bad, 4)).toThrow();
  });
  it('permits clarification without a calculation preview and never treats it as ready', () => {
    const raw: any = base();
    delete raw.preview;
    raw.semanticProposal = [];
    raw.clarifications = [
      {
        id: 'refundDenominator',
        question: '분모를 선택하세요',
        choices: [
          { value: 'orders', label: '주문 건수' },
          { value: 'amount', label: '매출 금액' },
        ],
        affectedBlockIds: [],
      },
    ];
    expect(validateCreationProposal(raw, 4).clarifications).toHaveLength(1);
  });
  it('rejects empty or mixed unverifiable previews', () => {
    const bad: any = base();
    bad.preview.widgets = [];
    expect(() => validateCreationProposal(bad, 4)).toThrow();
  });
  it('shows missing columns without fake choices or preview', () => {
    const raw: any = base();
    delete raw.preview;
    raw.semanticProposal = [];
    raw.clarifications = [{ id: 'missingColumns', question: '환불액 열이 없습니다.', choices: [], affectedBlockIds: [] }];
    expect(validateCreationProposal(raw, 4).preview).toBeUndefined();
  });
  it('accepts an unsupported request without choices and rejects fake choices', () => {
    const raw: any = base();
    delete raw.preview;
    raw.semanticProposal = [];
    raw.clarifications = [
      { id: 'unsupportedRequest', question: '상위 N개 제한은 아직 지원하지 않습니다.', choices: [], affectedBlockIds: [] },
    ];
    expect(validateCreationProposal(raw, 4).clarifications?.[0].id).toBe('unsupportedRequest');
    raw.clarifications[0].choices = [{ value: 'orders', label: '주문 수' }];
    expect(() => validateCreationProposal(raw, 4)).toThrow();
  });
});

it('explains file parsing failures as a file recovery action', () => {
  expect(creationError({ response: { status: 400 } }, 'file')).toContain('파일 손상');
});

it.each([
  { code: 'STUDIO_COMMERCE_UNIT_MISMATCH', currency: 'KRW' },
  { data: { code: 'STUDIO_COMMERCE_UNIT_MISMATCH', currency: 'USD' } },
  { code: 'STUDIO_UNIT_MISMATCH', currency: 'USD' },
])('explains pinned unit mismatch without displaying server details', data => {
  const message = creationError({ response: { status: 400, data: { ...data, message: 'private-file secret-path' } } });
  expect(message).toContain('단위');
  expect(message).toContain('다시 생성');
  expect(message).not.toMatch(/private-file|secret-path/);
});
it('preserves full root and private draft while reused metric/dimension bases stay independent', async () => {
  const { basisFixture } = await import('@/api/businessBasis.fixture');
  const raw: any = base();
  raw.businessBasis = basisFixture;
  raw.preview.draft.businessBasis = basisFixture;
  raw.profile.columns = basisFixture.columns.map(c => ({ name: c.column, type: c.nativeType }));
  raw.semanticProposal[0].metric = { id: 7, definitionVersion: 3, businessBasis: null };
  raw.semanticProposal[0].dimension = {
    column: 'code',
    type: 'INTEGER',
    schemaVersion: 'v1',
    businessBasis: { ...basisFixture, columns: basisFixture.columns.slice(0, 1) },
  };
  const result = validateCreationProposal(raw, 4);
  expect(result.businessBasis).toEqual(basisFixture);
  expect(result.preview?.draft.businessBasis).toEqual(basisFixture);
  expect(result.semanticProposal[0].metric.businessBasis).toBeNull();
  expect(result.semanticProposal[0].dimension?.businessBasis?.columns).toHaveLength(1);
  raw.semanticProposal[0].metric.businessBasis = { ...basisFixture, catalogVersion: 0 };
  expect(() => validateCreationProposal(raw, 4)).toThrow();
});
it('rejects a truncated root context or missing/divergent private draft basis instead of substituting metric lineage', async () => {
  const { basisFixture } = await import('@/api/businessBasis.fixture');
  const raw: any = base();
  raw.profile.columns = basisFixture.columns.map(c => ({ name: c.column, type: c.nativeType }));
  raw.businessBasis = basisFixture;
  expect(() => validateCreationProposal(raw, 4)).toThrow(/업무 기준/);
  raw.preview.draft.businessBasis = { ...basisFixture, catalogVersion: 3 };
  expect(() => validateCreationProposal(raw, 4)).toThrow(/업무 기준/);
  raw.preview.draft.businessBasis = basisFixture;
  raw.businessBasis = { ...basisFixture, columns: [basisFixture.columns[1]] };
  expect(() => validateCreationProposal(raw, 4)).toThrow(/전체 업무 기준/);
  raw.businessBasis = basisFixture;
  expect(validateCreationProposal(raw, 4).businessBasis?.columns).toHaveLength(3);
});
it.each([null, 'day'])(
  'preserves proposal/widget explicit defaultDateColumn %s with independent full block basis',
  async date => {
    const { basisFixture } = await import('@/api/businessBasis.fixture');
    const raw: any = base();
    raw.semanticProposal[0].businessBasis = basisFixture;
    raw.semanticProposal[0].defaultDateColumn = date;
    Object.assign(raw.preview.draft.widgets[0], { businessBasis: basisFixture, defaultDateColumn: date });
    const result = validateCreationProposal(raw, 4);
    expect(result.semanticProposal[0].defaultDateColumn).toBe(date);
    expect(result.preview?.draft.widgets[0].defaultDateColumn).toBe(date);
    expect(result.semanticProposal[0].businessBasis).toEqual(basisFixture);
    raw.semanticProposal[0].defaultDateColumn = 1;
    expect(() => validateCreationProposal(raw, 4)).toThrow();
  },
);

// A fresh MySQL without the chart seed must not ask users to rewrite valid data.
it.each([
  { message: 'chart component unavailable' },
  { data: { message: 'chart component unavailable' } },
  { data: 'chart component unavailable' },
])('explains missing chart setup without a raw English or generic message', data => {
  const message = creationError({ response: { status: 400, data } });
  expect(message).toBe(CHART_SETUP_UNAVAILABLE_MESSAGE);
  expect(message).toContain('아무것도 저장되지 않았습니다');
  expect(message).toContain('운영자가 서버 설정을 마쳐야');
  expect(message).not.toContain('일시적');
  expect(message).not.toContain('잠시 후');
  expect(message).not.toContain('다시 시도');
  expect(message).not.toContain('chart component');
  expect(message).not.toContain('필수 열');
});
it('does not display arbitrary server details as chart setup advice', () => {
  const message = creationError({
    response: { status: 400, data: { message: 'chart component unavailable: private-path' } },
  });
  expect(message).not.toContain('private-path');
  expect(message).toContain('필수 열');
});
