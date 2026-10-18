import isEqual from 'lodash/isEqual';
import { BusinessBasis, assertOptionalBusinessBasis, assertDefaultDateColumn } from '@/api/businessBasis';
import { get, post } from '@/helpers/apiHelper';
import { studioAssert } from './studioDocument';
import { StudioPreview, validateStudioPreview } from './studioApi';
export type StudioSource = { id: number; name: string; engine: string; catalogLabel?: string; catalogVersion?: number };
export type SourceColumn = {
  label?: string;
  unit?: string;
  businessType?: string;
  dateFormat?: string;
  name: string;
  type: string;
  numeric?: boolean;
  temporal?: boolean;
  nullCount?: string;
};
export type SourceProfile = {
  sourceId: number;
  name?: string;
  rowCount: string;
  columns: SourceColumn[];
  supported?: boolean;
  dataVersion?: string;
};
export type CreationMetric = {
  businessBasis?: BusinessBasis | null;
  id?: number;
  definitionVersion?: number | string;
  label?: string;
  aggregation?: string;
  column?: string;
  denominatorColumn?: string;
  weightColumn?: string;
  scale?: number;
  unit?: string;
  decimalPlaces?: number;
  numberNotation?: string;
  [key: string]: unknown;
};
export type CreationSemantic = {
  defaultDateColumn?: string | null;
  businessBasis?: BusinessBasis | null;
  dimensionBusinessBasis?: BusinessBasis | null;
  title: string;
  kind: string;
  metric: CreationMetric;
  dimension?: { column: string; type: string; schemaVersion: string; businessBasis?: BusinessBasis | null };
  [key: string]: unknown;
};
export type CreationClarification = {
  id: string;
  question: string;
  choices: Array<{ value: string; label: string }>;
  affectedBlockIds: string[];
};
export type CreationProposal = {
  businessBasis?: BusinessBasis | null;
  proposalId: string;
  parentProposalId?: string;
  requestPrompt?: string;
  sourceId: number;
  sourceRevision: string;
  title: string;
  profile: SourceProfile;
  semanticProposal: CreationSemantic[];
  preview?: StudioPreview;
  clarifications?: CreationClarification[];
};
export const creationData = (response: any) => (response?.data?.status === 'SUCCESS' ? response.data.data : response?.data);
export function validateCreationProposal(input: unknown, sourceId: number): CreationProposal {
  const p = input as CreationProposal;
  assertOptionalBusinessBasis(p);
  studioAssert(!!p && typeof p === 'object' && p.sourceId === sourceId, '선택한 데이터 소스와 다른 생성 결과입니다.');
  studioAssert(
    typeof p.sourceRevision === 'string' &&
      /^[a-f0-9]{64}$/.test(p.sourceRevision) &&
      typeof p.proposalId === 'string' &&
      p.proposalId.length > 0 &&
      p.proposalId.length <= 128,
    '생성 제안의 기준 버전을 확인하지 못했습니다.',
  );
  studioAssert(
    p.profile?.sourceId === sourceId && Array.isArray(p.profile.columns) && typeof p.profile.rowCount === 'string',
    '소스 프로파일을 확인하지 못했습니다.',
  );
  if (p.businessBasis)
    studioAssert(
      p.businessBasis.columns.length === p.profile.columns.length &&
        p.profile.columns.every(c => p.businessBasis?.columns.some(b => b.column === c.name && b.nativeType === c.type)),
      '생성안의 전체 업무 기준이 누락됐습니다.',
    );
  studioAssert(Array.isArray(p.semanticProposal) && p.semanticProposal.length <= 6, '지표 정의 수를 확인해 주세요.');
  for (const item of p.semanticProposal) {
    assertDefaultDateColumn(item, item.kind);
    if (Object.prototype.hasOwnProperty.call(item, 'dimensionBusinessBasis'))
      assertOptionalBusinessBasis({ businessBasis: item.dimensionBusinessBasis });
    assertOptionalBusinessBasis(item.metric);
    assertOptionalBusinessBasis(item.dimension);
    studioAssert(
      typeof item.title === 'string' &&
        item.title.length > 0 &&
        item.title.length <= 300 &&
        ['BOARD_NUMERIC', 'CHART_LINE', 'CHART_COLUMN', 'CHART_BAR'].includes(item.kind) &&
        !!item.metric &&
        typeof item.metric === 'object',
      '생성 지표의 형식을 확인해 주세요.',
    );
    if (item.metric.id !== undefined)
      studioAssert(
        Number.isSafeInteger(item.metric.id) && item.metric.id > 0 && item.metric.definitionVersion !== undefined,
        '저장 지표 버전을 확인하지 못했습니다.',
      );
    if (item.dimension)
      studioAssert(
        typeof item.dimension.column === 'string' &&
          typeof item.dimension.type === 'string' &&
          typeof item.dimension.schemaVersion === 'string',
        '차원 열·타입·버전을 확인해 주세요.',
      );
  }
  if (p.clarifications?.length) {
    studioAssert(p.clarifications.length <= 6, '추가 질문 수를 확인해 주세요.');
    for (const c of p.clarifications)
      studioAssert(
        ['refundDenominator', 'missingColumns'].includes(c.id) &&
          typeof c.question === 'string' &&
          c.question.length <= 1000 &&
          Array.isArray(c.choices) &&
          (c.id === 'missingColumns' ? c.choices.length === 0 : c.choices.length >= 2) &&
          c.choices.length <= 4 &&
          c.choices.every(
            x => ['orders', 'amount'].includes(x.value) && typeof x.label === 'string' && x.label.length <= 200,
          ),
        '추가 질문 형식을 확인해 주세요.',
      );
    studioAssert(!p.preview, '의미 확인 전 계산 결과를 적용할 수 없습니다.');
  } else {
    studioAssert(
      typeof p.title === 'string' && !!p.title.trim() && p.semanticProposal.length > 0,
      '생성할 지표 정의가 없습니다.',
    );
    p.preview = validateStudioPreview(p.preview);
    studioAssert(isEqual(p.businessBasis, p.preview.draft.businessBasis), '미리보기의 업무 기준이 생성안과 다릅니다.');
    studioAssert(
      p.preview.draft.databaseId === sourceId && p.preview.widgets.length === p.semanticProposal.length,
      '계산 미리보기의 소스 또는 지표 수가 다릅니다.',
    );
  }
  return p;
}
export const fetchStudioSources = async (): Promise<StudioSource[]> => {
  const rows = creationData(await get('/bi/sources', { catalog: '1' }));
  studioAssert(
    Array.isArray(rows) &&
      rows.every(
        row =>
          Number.isSafeInteger(row.id) &&
          row.id > 0 &&
          typeof row.name === 'string' &&
          typeof row.engine === 'string' &&
          ((row.catalogLabel === undefined && row.catalogVersion === undefined) ||
            (typeof row.catalogLabel === 'string' &&
              row.catalogLabel.trim().length > 0 &&
              row.catalogLabel.length <= 100 &&
              Number.isSafeInteger(row.catalogVersion) &&
              row.catalogVersion > 0)),
      ),
    '데이터 소스 목록을 확인하지 못했습니다.',
  );
  return rows;
};
export const creationError = (cause: unknown, context: 'file' | 'generation' = 'generation') => {
  const status = Number((cause as any)?.response?.status);
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '이 데이터 소스를 사용할 권한이 없습니다. 다른 소스를 선택해 주세요.';
  if (status === 409) return '데이터 또는 지표 기준이 변경되었습니다. 소스를 새로 확인하고 다시 생성해 주세요.';
  if (status === 400 && context === 'file')
    return '파일을 읽지 못했습니다. CSV·JSON·Parquet 형식과 파일 손상 여부를 확인한 뒤 다시 선택해 주세요.';
  if (status === 400) return '필수 열과 지표 정의를 확인해 주세요. 요청을 구체적으로 적어 다시 시도할 수 있습니다.';
  if (status === 503)
    return 'AI 연결 또는 처리 상태를 확인하지 못했습니다. 기존 입력을 유지했습니다. 잠시 후 다시 시도해 주세요.';
  return '처리하지 못했습니다. 연결 상태와 파일 형식을 확인한 뒤 다시 시도해 주세요. 입력은 유지됩니다.';
};
export async function proposeStudio(body: any, signal: AbortSignal): Promise<CreationProposal> {
  const response = await post('/studio/proposals', body, { timeout: 180000, signal });
  if (signal.aborted) throw new Error('cancelled');
  return validateCreationProposal(creationData(response), body.sourceId);
}
