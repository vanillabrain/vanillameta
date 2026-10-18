/**
 * UC-021: the private reuse definition captured with a publication.
 *
 * A recipe is the smallest thing a recipient needs to rebuild a copy on their own source:
 * the validated draft (restricted SQL, display options, block identity), the original
 * breakpoint layouts, and the source columns the SQL reads with their types. It never
 * carries the owner's database id, connection, metrics, aggregated rows or preview rows.
 * Everything here is pure: JSON in, JSON out, no database and no HTTP.
 */
import { BadRequestException } from '@nestjs/common';
import { DashboardDraft, validateDraft } from '../ai/dashboard-draft';
import {
  ReuseColumn,
  ReuseSourceProfile,
  reuseColumns,
  reuseScope,
  ReuseScope,
} from './dashboard-remap';

export const REUSE_RECIPE_SCHEMA_VERSION = 1 as const;
export const REUSE_RECIPE_MAX_BYTES = 60 * 1024;
/** Redacted placeholder: a recipe never carries the owner's live source identity. */
export const REUSE_RECIPE_SOURCE_ID = 1;

const BREAKPOINTS = ['mobile', 'tablet', 'desktop'] as const;
const RECIPE_KEYS = ['schemaVersion', 'analysis', 'profile', 'conditionSchema'];
const PROFILE_KEYS = ['sourceId', 'columns'];
const MESSAGE = '재사용 정의를 확인할 수 없습니다. 다시 캡처해 주세요.';

function reject(): never {
  throw new BadRequestException(MESSAGE);
}

export type ReuseRecipeRect = { x: number; y: number; w: number; h: number };
export type ReuseRecipeLayouts = Partial<
  Record<(typeof BREAKPOINTS)[number], Record<string, ReuseRecipeRect>>
>;
export type ReuseRecipeAnalysis = DashboardDraft &
  ReuseScope & {
    databaseId: number;
    responsiveLayouts: ReuseRecipeLayouts;
  };
export type ReuseRecipeProfile = ReuseSourceProfile & { supported?: boolean };

/**
 * Column names must not repeat; the reuse remap resolves them case-insensitively. The list
 * may be empty: a COUNT(*) or literal-only draft needs no field mapping on the target.
 */
function projectColumns(value: unknown): ReuseColumn[] {
  if (!Array.isArray(value) || value.length > 128) reject();
  const seen = new Set<string>();
  return value.map((column: any) => {
    if (
      !column ||
      typeof column !== 'object' ||
      Array.isArray(column) ||
      Object.keys(column).some(key => !['name', 'type', 'numeric', 'temporal'].includes(key)) ||
      typeof column.name !== 'string' ||
      !column.name.trim() ||
      column.name.length > 128 ||
      typeof column.type !== 'string' ||
      !column.type.trim() ||
      column.type.length > 128
    )
      reject();
    const key = column.name.trim().toLowerCase();
    if (seen.has(key)) reject();
    seen.add(key);
    return {
      name: column.name.trim(),
      type: column.type,
      numeric: column.numeric === true,
      temporal: column.temporal === true,
    };
  });
}

/**
 * Keep the original per-breakpoint geometry for the draft's block ids. Missing
 * breakpoints or missing rects stay missing: the reuse preview reports what to save.
 * A rect that is present but malformed fails closed instead of guessing coordinates.
 */
function projectLayouts(value: unknown, blockIds: string[]): ReuseRecipeLayouts {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) reject();
  const source = value as Record<string, any>;
  const result: ReuseRecipeLayouts = {};
  for (const name of BREAKPOINTS) {
    const map = source[name];
    if (map === undefined) continue;
    if (!map || typeof map !== 'object' || Array.isArray(map)) reject();
    const rects: Record<string, ReuseRecipeRect> = {};
    for (const id of blockIds) {
      const rect = (map as Record<string, any>)[id];
      if (rect === undefined) continue;
      if (!rect || typeof rect !== 'object' || Array.isArray(rect)) reject();
      const { x, y, w, h } = rect;
      if (
        ![x, y, w, h].every(item => Number.isSafeInteger(item)) ||
        x < 0 ||
        y < 0 ||
        w < 1 ||
        h < 1
      )
        reject();
      rects[id] = { x, y, w, h };
    }
    result[name] = rects;
  }
  return result;
}

/**
 * Capture the publication's reuse definition. The source id is redacted to a constant and
 * only the columns the draft actually reads are kept, in first-use order.
 */
export function buildReuseRecipe(analysis: unknown, sourceProfile: ReuseRecipeProfile): string {
  if (sourceProfile?.supported === false)
    throw new BadRequestException('서버에 저장한 파일 분석만 재사용을 허용할 수 있습니다.');
  const draft = validateDraft(analysis as any);
  const scope = reuseScope(analysis, sourceProfile);
  const columns = reuseColumns({ ...draft, ...scope }, sourceProfile);
  const recipe = {
    schemaVersion: REUSE_RECIPE_SCHEMA_VERSION,
    ...(scope.conditionSemantics
      ? {
          conditionSchema: projectColumns(
            (sourceProfile.conditionSchema ?? sourceProfile.columns).map(column => ({
              name: column.name,
              type: column.type,
              ...('numeric' in column ? { numeric: column.numeric } : {}),
              ...('temporal' in column ? { temporal: column.temporal } : {}),
            })),
          ),
        }
      : {}),
    analysis: {
      ...draft,
      ...scope,
      databaseId: REUSE_RECIPE_SOURCE_ID,
      responsiveLayouts: projectLayouts(
        (analysis as any)?.responsiveLayouts,
        draft.widgets.map(widget => widget.blockId as string).filter(id => id !== undefined),
      ),
    },
    profile: { sourceId: REUSE_RECIPE_SOURCE_ID, columns: projectColumns(columns) },
  };
  const serialized = JSON.stringify(recipe);
  if (Buffer.byteLength(serialized) > REUSE_RECIPE_MAX_BYTES)
    throw new BadRequestException('재사용 정의가 너무 큽니다. 블록을 줄여 주세요.');
  return serialized;
}

/**
 * Read a captured recipe back. The shape is exact: an unknown key, another source id or a
 * column set that does not cover the SQL is rejected instead of being forwarded.
 */
export function readReuseRecipe(serialized: unknown): {
  analysis: ReuseRecipeAnalysis;
  profile: ReuseRecipeProfile;
} {
  if (typeof serialized !== 'string' || !serialized.length) reject();
  if (Buffer.byteLength(serialized) > REUSE_RECIPE_MAX_BYTES) reject();
  let parsed: any;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    reject();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reject();
  if (Object.keys(parsed).some(key => !RECIPE_KEYS.includes(key))) reject();
  if (parsed.schemaVersion !== REUSE_RECIPE_SCHEMA_VERSION) reject();
  const stored = parsed.analysis;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) reject();
  // A live database id in a stored recipe means the redaction was bypassed: refuse it.
  if (stored.databaseId !== REUSE_RECIPE_SOURCE_ID) reject();
  const draft = validateDraft(stored);
  const profile = parsed.profile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) reject();
  if (Object.keys(profile).some(key => !PROFILE_KEYS.includes(key))) reject();
  if (profile.sourceId !== REUSE_RECIPE_SOURCE_ID) reject();
  const columns = projectColumns(profile.columns);
  if (stored.defaultConditions !== undefined) reject();
  const conditionSchema =
    parsed.conditionSchema === undefined ? undefined : projectColumns(parsed.conditionSchema);
  if ((stored.conditionSemantics !== undefined) !== (conditionSchema !== undefined)) reject();
  if (
    conditionSchema &&
    columns.some(
      column =>
        !conditionSchema.some(native => native.name === column.name && native.type === column.type),
    )
  )
    reject();
  const scope = reuseScope(stored, {
    sourceId: REUSE_RECIPE_SOURCE_ID,
    columns,
    ...(conditionSchema ? { conditionSchema } : {}),
  });
  const analysis: ReuseRecipeAnalysis = {
    ...draft,
    ...scope,
    databaseId: REUSE_RECIPE_SOURCE_ID,
    responsiveLayouts: projectLayouts(
      stored.responsiveLayouts,
      draft.widgets.map(widget => widget.blockId as string).filter(id => id !== undefined),
    ),
  };
  // The stored columns must be exactly what the draft reads, so a shortened or padded
  // profile can never be forwarded to the recipient's remap.
  const required = reuseColumns(analysis, {
    sourceId: REUSE_RECIPE_SOURCE_ID,
    columns,
    ...(conditionSchema ? { conditionSchema } : {}),
  });
  const names = (values: ReuseColumn[]) =>
    values
      .map(column => column.name.trim().toLowerCase())
      .sort()
      .join(',');
  if (names(required) !== names(columns)) reject();
  return {
    analysis,
    profile: {
      sourceId: REUSE_RECIPE_SOURCE_ID,
      columns,
      ...(conditionSchema ? { conditionSchema } : {}),
    },
  };
}
