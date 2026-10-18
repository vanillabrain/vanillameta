import { validateStudioConditions } from '@/pages/Dashboard/Studio/studioDocument';
import type { StudioConditions } from '@/pages/Dashboard/Studio/studioTypes';

/** Keep the validated snapshot immutable; never rebind its file hash to a new catalog. */
export function exploreConditions(value: unknown, sourceRevision?: string): StudioConditions {
  const snapshot = validateStudioConditions(value);
  if (sourceRevision !== undefined && snapshot.sourceRevision !== sourceRevision)
    throw new Error(
      '적용 조건의 파일 버전이 다릅니다. 현재 입력을 보존하고 조건을 다시 검토하거나 명시적으로 제거해 주세요.',
    );
  return snapshot;
}

/** Export basis must come from the actual response, with exactly the selected measures. */
export function responseMeasureVersions(value: unknown, ids: readonly number[]): Record<string, number> | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !ids.length ||
    new Set(ids).size !== ids.length ||
    Object.keys(value).length !== ids.length
  )
    return undefined;
  if (
    ids.some(
      id =>
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Object.prototype.hasOwnProperty.call(value, String(id)) ||
        !Number.isSafeInteger(value[String(id)]) ||
        value[String(id)] <= 0,
    )
  )
    return undefined;
  return Object.fromEntries(ids.map(id => [String(id), value[String(id)]]));
}
