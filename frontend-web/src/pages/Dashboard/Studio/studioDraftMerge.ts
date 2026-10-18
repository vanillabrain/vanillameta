import { studioClone, validateStudioDocument } from './studioDocument';
import { isTemporaryStudioId, STUDIO_BREAKPOINTS, StudioBlock, StudioDocumentV1 } from './studioTypes';

export type StudioDraftConflict = { label: string; mine: string; latest: string };
export type StudioDraftMerge = { document: StudioDocumentV1 | null; conflicts: StudioDraftConflict[]; blocked: string[] };
const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, canonical(v[k])]),
      )
    : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const displayLabels: Record<string, string> = {
  decimalPlaces: '소수 자릿수',
  numberNotation: '숫자 표시',
  prefix: '접두 단위',
  suffix: '접미 단위',
  timeGrain: '시간 단위',
  presentation: '블록 표현',
};
const describe = (v: unknown) => (v === undefined ? '없음' : typeof v === 'string' ? v : JSON.stringify(v));

/** UC046: no changed field or geometry may silently overwrite a concurrent edit. */
export function mergeStudioDraft(
  latestValue: StudioDocumentV1,
  localValue: StudioDocumentV1,
  baselineValue: StudioDocumentV1,
): StudioDraftMerge {
  const conflicts: StudioDraftConflict[] = [],
    blocked: string[] = [];
  try {
    const latest = validateStudioDocument(latestValue),
      local = validateStudioDocument(localValue),
      baseline = validateStudioDocument(baselineValue);
    if ([local, baseline].some(d => d.dashboardId !== latest.dashboardId || d.sourceId !== latest.sourceId))
      throw Error('대시보드 또는 데이터 소스가 다릅니다. 보관 초안은 유지했습니다.');
    const atom = (base: any, mine: any, remote: any, label: string) => {
      if (equal(mine, base)) return remote;
      if (!equal(remote, base) && !equal(mine, remote))
        conflicts.push({ label, mine: describe(mine), latest: describe(remote) });
      return mine;
    };
    const geometry = (d: StudioDocumentV1, id: string) => STUDIO_BREAKPOINTS.map(bp => d.layouts[bp].find(g => g.id === id));
    const changed = (d: StudioDocumentV1, block: StudioBlock) =>
      !equal(
        d.blocks.find(b => b.id === block.id),
        block,
      ) || !equal(geometry(d, block.id), geometry(baseline, block.id));
    const document = studioClone(latest);
    document.title = atom(baseline.title, local.title, latest.title, '대시보드 제목');
    for (const key of ['filters', 'dateRange', 'conditions'] as const) {
      const value = atom(
        baseline[key],
        local[key],
        latest[key],
        key === 'filters' ? '공통 필터' : key === 'conditions' ? '포함·제외 조건' : '공통 기간',
      );
      if (value === undefined) delete document[key];
      else (document as any)[key] = value;
    }
    document.blocks = [];
    for (const remote of latest.blocks) {
      const base = baseline.blocks.find(b => b.id === remote.id),
        mine = local.blocks.find(b => b.id === remote.id);
      if (!base) {
        document.blocks.push(remote);
        continue;
      }
      if (!mine) {
        if (changed(latest, base))
          conflicts.push({ label: base.title + ' · 블록 삭제', mine: '삭제', latest: '변경된 블록 유지' });
        continue;
      }
      if (
        ['kind', 'definitionKey', 'measureRefs', 'dimensionRefs'].some(k => !equal((remote as any)[k], (base as any)[k])) &&
        changed(local, base)
      ) {
        blocked.push(base.title + ': 최신 계산 정의가 바뀌어 자동 병합할 수 없습니다.');
        continue;
      }
      if (['kind', 'definitionKey', 'measureRefs', 'dimensionRefs'].some(k => !equal((mine as any)[k], (base as any)[k]))) {
        blocked.push(base.title + ': 초안의 계산 정의 변경은 자동 병합할 수 없습니다.');
        continue;
      }
      const block = studioClone(remote);
      block.title = atom(base.title, mine.title, remote.title, base.title + ' · 제목');
      block.description = atom(base.description, mine.description, remote.description, base.title + ' · 설명');
      for (const key of Array.from(
        new Set([...Object.keys(base.display), ...Object.keys(mine.display), ...Object.keys(remote.display)]),
      )) {
        const value = atom(
          (base.display as any)[key],
          (mine.display as any)[key],
          (remote.display as any)[key],
          base.title + ' · ' + (displayLabels[key] ?? '표시 항목'),
        );
        if (value === undefined) delete (block.display as any)[key];
        else (block.display as any)[key] = value;
      }
      document.blocks.push(block);
    }
    for (const base of baseline.blocks) {
      if (!latest.blocks.some(b => b.id === base.id) && local.blocks.some(b => b.id === base.id) && changed(local, base))
        blocked.push(base.title + ': 최신본에서 삭제된 블록의 변경은 자동 복구할 수 없습니다.');
    }
    for (const mine of local.blocks.filter(b => !baseline.blocks.some(base => base.id === b.id))) {
      if (!isTemporaryStudioId(mine.id) || latest.blocks.some(b => b.id === mine.id))
        throw Error('새 블록의 기준을 확인할 수 없습니다. 보관 초안은 유지했습니다.');
      if (!latest.blocks.some(b => b.definitionKey === mine.definitionKey && b.kind === mine.kind))
        throw Error('복제한 블록의 계산 정의가 최신본에 없습니다. 보관 초안은 유지했습니다.');
      document.blocks.push(studioClone(mine));
    }
    for (const bp of STUDIO_BREAKPOINTS) {
      document.layouts[bp] = document.blocks.map(block => {
        const base = baseline.layouts[bp].find(g => g.id === block.id),
          mine = local.layouts[bp].find(g => g.id === block.id),
          remote = latest.layouts[bp].find(g => g.id === block.id);
        return atom(
          base,
          mine ?? base,
          remote,
          block.title + ' · ' + { lg: '데스크톱', md: '태블릿', xs: '모바일' }[bp] + ' 배치',
        );
      });
    }
    if (blocked.length) return { document: null, conflicts, blocked };
    try {
      return { document: validateStudioDocument(document), conflicts, blocked };
    } catch {
      throw Error('병합한 배치가 겹치거나 블록 수·경계를 벗어납니다. 보관 초안은 유지했습니다.');
    }
  } catch (error) {
    return {
      document: null,
      conflicts,
      blocked: [...blocked, error instanceof Error ? error.message : '초안을 병합하지 못했습니다.'],
    };
  }
}
