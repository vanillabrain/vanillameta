import { isStudioId, STUDIO_BREAKPOINTS, STUDIO_COLUMNS, StudioDocumentV1, StudioLayoutItem } from './studioTypes';
export const studioClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function studioAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const record = (value: unknown): value is Record<string, any> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
export function studioKeys(value: unknown, keys: string[]) {
  studioAssert(
    record(value) && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key)),
    '지원하지 않는 문서 필드입니다.',
  );
}
export function studioText(value: unknown, max: number, empty = false) {
  studioAssert(typeof value === 'string' && value.length <= max && (empty || !!value.trim()), '문자열을 확인해 주세요.');
}
export function studioPositive(value: unknown) {
  studioAssert(Number.isSafeInteger(value) && Number(value) > 0, '참조 ID를 확인해 주세요.');
}
export const studioOverlap = (a: StudioLayoutItem, b: StudioLayoutItem) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Structural validation only: source ownership and live reference availability are a server concern. */
export function validateStudioDocument(input: unknown): StudioDocumentV1 {
  studioKeys(input, ['schemaVersion', 'dashboardId', 'revision', 'title', 'sourceId', 'blocks', 'layouts']);
  const d = input as StudioDocumentV1;
  studioAssert(d.schemaVersion === 1, '지원하지 않는 Studio 문서 버전입니다.');
  studioPositive(d.sourceId);
  studioText(d.title, 300);
  if (d.dashboardId !== undefined) studioPositive(d.dashboardId);
  if (d.revision !== undefined)
    studioAssert(typeof d.revision === 'string' && /^[a-f0-9]{64}$/.test(d.revision), '문서 revision을 확인해 주세요.');
  studioAssert(Array.isArray(d.blocks) && d.blocks.length <= 6, '현재 최대 6개 블록을 지원합니다.');
  const ids = new Set<string>();
  Array.from(d.blocks).forEach(b => {
    studioKeys(b, ['id', 'kind', 'definitionKey', 'title', 'description', 'measureRefs', 'dimensionRefs', 'display']);
    studioAssert(isStudioId(b.id) && !ids.has(b.id), '블록 ID가 없거나 중복됩니다.');
    ids.add(b.id);
    studioAssert(
      ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'].includes(b.kind),
      '지원하지 않는 블록 종류입니다.',
    );
    studioText(b.definitionKey, 128);
    studioAssert(/^[A-Za-z0-9:_-]+$/.test(b.definitionKey), '정의 참조를 확인해 주세요.');
    studioText(b.title, 300);
    studioText(b.description, 1000, true);
    studioAssert(
      Array.isArray(b.measureRefs) &&
        b.measureRefs.length <= 6 &&
        Array.isArray(b.dimensionRefs) &&
        b.dimensionRefs.length <= 6,
      '지표·차원 참조를 확인해 주세요.',
    );
    const measures = new Set<number>();
    Array.from(b.measureRefs).forEach(m => {
      studioKeys(m, ['id', 'definitionVersion']);
      studioPositive(m.id);
      studioText(m.definitionVersion, 128);
      studioAssert(!measures.has(m.id), '지표 참조가 중복됩니다.');
      measures.add(m.id);
    });
    const dims = new Set<string>();
    Array.from(b.dimensionRefs).forEach(r => {
      studioKeys(r, ['key', 'sourceId', 'schemaVersion']);
      studioText(r.key, 255);
      studioText(r.schemaVersion, 128);
      studioAssert(r.sourceId === d.sourceId && !dims.has(r.key), '차원의 소스가 다르거나 참조가 중복됩니다.');
      dims.add(r.key);
    });
    studioKeys(b.display, ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain']);
    const p = b.display;
    if (p.timeGrain !== undefined)
      studioAssert(
        b.kind === 'CHART_LINE' && ['auto', 'day', 'week', 'month'].includes(p.timeGrain),
        '시간 집계를 확인해 주세요.',
      );
    if (p.decimalPlaces !== undefined)
      studioAssert(
        Number.isInteger(p.decimalPlaces) && p.decimalPlaces >= 0 && p.decimalPlaces <= 6,
        '소수 자릿수를 확인해 주세요.',
      );
    if (p.numberNotation !== undefined)
      studioAssert(['full', 'compact'].includes(p.numberNotation), '숫자 표시를 확인해 주세요.');
    for (const key of ['prefix', 'suffix']) if (p[key] !== undefined) studioText(p[key], 100, true);
  });
  studioKeys(d.layouts, ['lg', 'md', 'xs']);
  for (const bp of STUDIO_BREAKPOINTS) {
    const items = d.layouts[bp];
    studioAssert(Array.isArray(items) && items.length === ids.size, '블록과 배치가 일치하지 않습니다.');
    const seen = new Set<string>();
    Array.from(items).forEach((g, i) => {
      studioKeys(g, ['id', 'x', 'y', 'w', 'h']);
      studioAssert(ids.has(g.id) && !seen.has(g.id), '배치 ID가 없거나 중복됩니다.');
      seen.add(g.id);
      studioAssert(
        [g.x, g.y, g.w, g.h].every(Number.isSafeInteger) &&
          g.x >= 0 &&
          g.y >= 0 &&
          g.w > 0 &&
          g.h > 0 &&
          g.x + g.w <= STUDIO_COLUMNS[bp] &&
          Number.isSafeInteger(g.y + g.h),
        '배치가 허용 범위를 벗어났습니다.',
      );
      studioAssert(
        items.slice(0, i).every(other => !studioOverlap(g, other)),
        '블록 배치가 겹칩니다.',
      );
    });
  }
  return studioClone(d);
}
