import { describe, it, expect } from 'vitest';
import { creationError, validateCreationProposal } from './studioCreation';
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
