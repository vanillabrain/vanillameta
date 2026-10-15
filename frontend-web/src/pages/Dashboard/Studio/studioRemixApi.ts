import { get, post } from '@/helpers/apiHelper';
import { studioAssert, validateStudioDocument } from './studioDocument';
import { SourceProfile } from './studioCreation';
import { PublishedBlock } from './studioPublication';
import { StudioDocumentV1 } from './studioTypes';
export type RemixBlock = { id: string; title: string; kind: string; supported: boolean; reason?: string };
export type RemixRequirements = {
  token: string;
  version: number;
  title: string;
  requiredFields: { name: string; type: string; blockIds: string[] }[];
  blocks: RemixBlock[];
};
export type RemixField = {
  sourceColumn: string;
  sourceType: string;
  targetColumn?: string;
  status: 'mapped' | 'missing' | 'incompatible' | 'ambiguous';
  candidates: string[];
};
export type RemixInput = {
  targetSourceId: number;
  mapping: Record<string, string>;
  excludedBlockIds: string[];
  expectedVersion: number;
};
export type RemixSaveInput = RemixInput & { requestId: string; expectedSourceRevision: string };
export type RemixPreview = RemixRequirements & {
  targetSourceId: number;
  sourceRevision: string;
  profile: SourceProfile;
  mapping: Record<string, string>;
  fields: RemixField[];
  unmappedBlocks: { blockId: string; title: string; reason: string; missingFields: string[] }[];
  preview?: { widgets: any[] };
};
const config = { timeout: 180000, headers: { 'Cache-Control': 'no-cache' } };
const tokenPath = (token: string) => {
  studioAssert(/^[a-f0-9]{64}$/.test(token), '복제 링크를 확인해 주세요.');
  return '/studio/publications/' + encodeURIComponent(token);
};
export function validateRemixRequirements(input: any, token: string): RemixRequirements {
  studioAssert(
    !!input &&
      input.token === token &&
      Number.isSafeInteger(input.version) &&
      input.version > 0 &&
      typeof input.title === 'string' &&
      input.title.length <= 300,
    '게시된 복제 정의를 확인하지 못했습니다.',
  );
  studioAssert(
    Array.isArray(input.blocks) &&
      input.blocks.length > 0 &&
      input.blocks.length <= 6 &&
      input.blocks.every(
        (b: any) =>
          typeof b.id === 'string' && b.id.length <= 128 && typeof b.title === 'string' && typeof b.supported === 'boolean',
      ),
    '복제할 블록을 확인해 주세요.',
  );
  const ids = new Set(input.blocks.map((b: any) => b.id));
  studioAssert(
    Array.isArray(input.requiredFields) &&
      input.requiredFields.length <= 128 &&
      input.requiredFields.every(
        (f: any) =>
          typeof f.name === 'string' &&
          !!f.name &&
          f.name.length <= 256 &&
          typeof f.type === 'string' &&
          Array.isArray(f.blockIds) &&
          f.blockIds.every((id: string) => ids.has(id)),
      ),
    '필수 열 정의를 확인해 주세요.',
  );
  return input;
}
export function validateRemixPreview(input: any, token: string, request: RemixInput): RemixPreview {
  validateRemixRequirements(input, token);
  studioAssert(
    input.version === request.expectedVersion &&
      input.targetSourceId === request.targetSourceId &&
      /^[a-f0-9]{64}$/.test(input.sourceRevision ?? '') &&
      input.profile?.sourceId === request.targetSourceId &&
      Array.isArray(input.profile.columns),
    '데이터 또는 게시 버전이 변경되었습니다. 새로 확인해 주세요.',
  );
  studioAssert(
    !!input.mapping &&
      typeof input.mapping === 'object' &&
      !Array.isArray(input.mapping) &&
      Object.values(input.mapping).every(v => typeof v === 'string') &&
      Array.isArray(input.fields) &&
      Array.isArray(input.unmappedBlocks),
    '열 연결 결과를 확인하지 못했습니다.',
  );
  studioAssert(
    input.fields.every(
      (f: any) =>
        typeof f.sourceColumn === 'string' &&
        ['mapped', 'missing', 'incompatible', 'ambiguous'].includes(f.status) &&
        Array.isArray(f.candidates) &&
        f.candidates.every((c: any) => typeof c === 'string'),
    ),
    '열 연결 상태를 확인해 주세요.',
  );
  studioAssert(
    input.unmappedBlocks.every(
      (b: any) =>
        typeof b.blockId === 'string' &&
        typeof b.title === 'string' &&
        typeof b.reason === 'string' &&
        Array.isArray(b.missingFields),
    ),
    '미연결 블록 상태를 확인해 주세요.',
  );
  if (input.preview)
    studioAssert(
      Array.isArray(input.preview.widgets) &&
        input.preview.widgets.every(
          (w: any) =>
            typeof w.type === 'string' &&
            typeof w.valueField === 'string' &&
            Array.isArray(w.fields) &&
            Array.isArray(w.datas),
        ),
      '복제 미리보기 데이터를 확인하지 못했습니다.',
    );
  return input;
}
export const canCreateRemix = (p: RemixPreview | null, excluded: string[]) =>
  !!p && p.unmappedBlocks.length === 0 && p.blocks.some(b => !excluded.includes(b.id)) && !!p.preview?.widgets.length;
export function remixPreviewBlocks(p: RemixPreview): PublishedBlock[] {
  const retained = p.blocks;
  return (p.preview?.widgets ?? []).map((w: any, index: number) => ({
    id: w.blockId ?? retained[index]?.id ?? String(index),
    title: w.title ?? retained[index]?.title ?? '집계 결과',
    description: w.description ?? '',
    kind: w.type,
    valueField: w.valueField,
    categoryField: w.categoryField,
    fields: w.fields,
    datas: w.datas,
    display: {
      decimalPlaces: w.decimalPlaces ?? 2,
      numberNotation: w.numberNotation === 'compact' ? 'compact' : 'full',
      prefix: w.prefix ?? '',
      suffix: w.suffix ?? '',
    },
    ...(w.trend ? { trend: w.trend } : {}),
  }));
}
export async function fetchRemixRequirements(token: string): Promise<RemixRequirements> {
  const { data } = await get(tokenPath(token) + '/remix-template', undefined, config);
  return validateRemixRequirements(data, token);
}
export async function previewRemix(token: string, request: RemixInput, signal?: AbortSignal): Promise<RemixPreview> {
  const { data } = await post(tokenPath(token) + '/remix-preview', request, { ...config, signal });
  return validateRemixPreview(data, token, request);
}
export async function saveRemix(
  token: string,
  request: RemixSaveInput,
): Promise<{ dashboardId: number; document: StudioDocumentV1 }> {
  const { data } = await post(tokenPath(token) + '/remix', request, config);
  const document = validateStudioDocument(data?.document);
  studioAssert(
    Number.isSafeInteger(data.dashboardId) &&
      data.dashboardId > 0 &&
      document.dashboardId === data.dashboardId &&
      document.sourceId === request.targetSourceId &&
      !!document.revision,
    '복제 저장 결과를 확인하지 못했습니다.',
  );
  return { dashboardId: data.dashboardId, document };
}
export function remixError(error: any): string {
  const status = error?.response?.status;
  if (status === 401) return '로그인이 필요합니다. 로그인한 뒤 이 화면에서 다시 확인해 주세요.';
  if (status === 403) return '복제가 허용되지 않았거나 게시본·대상 데이터에 접근할 권한이 없습니다.';
  if (status === 410) return '게시가 중지되었거나 만료되었습니다. 새 링크를 요청해 주세요.';
  if (status === 404) return '복제할 게시본을 찾을 수 없습니다.';
  if (status === 409) return '게시 버전이나 대상 데이터가 변경되었습니다. 정의를 새로 확인하고 매핑을 검토해 주세요.';
  if (status === 400)
    return '복제 정의와 필수 열·형식을 확인해 주세요. 다른 소스를 선택하거나 해당 블록을 명시적으로 제외할 수 있습니다.';
  return '연결 또는 복제 상태를 확인하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.';
}
