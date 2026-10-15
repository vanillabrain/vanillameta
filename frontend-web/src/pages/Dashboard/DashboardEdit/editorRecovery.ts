/**
 * UC-017 editor recovery: pure comparison and bounded merge helpers.
 *
 * No React, MUI or network imports: the editor UI and its tests share this
 * module, and BR-017-02/03 keep the read/merge logic in pure functions.
 *
 * Groups compared per unit (block):
 * - presentation: title / unit / decimalPlaces / numberNotation / width / height, each independent
 * - layout: layouts.mobile / layouts.tablet / layouts.desktop, each independent
 * - model: kind / copyOf / definition / metricId / chart / dimension, compared through the
 *   canonical definition (item.definition while kind is a draft, else the server savedDefinition)
 *   reduced to actual sql / type / valueField / categoryField / description / prefix
 *
 * Duplicated display fields inside a definition (title / suffix / decimalPlaces / numberNotation /
 * blockId) never take part in the model group; the presentation groups own them.
 *
 * A unit keeps the local value only when local changed it and the latest snapshot did not.
 * A same-unit divergence is reported in `conflicts` and keeps the latest value unless the caller
 * passes that key in `confirmedKeys` after an explicit choice.
 */

export type RecoveryLayoutMode = 'mobile' | 'tablet' | 'desktop';

export type RecoveryRect = { x: number; y: number; w: number; h: number };

/**
 * Structural contract for a compared unit. Extra fields are ignored; `key` is the only required
 * field so the editor `Item` type stays assignable without declaring an index signature.
 */
export type RecoveryItem = {
  key: string;
  title?: string;
  unit?: string;
  decimalPlaces?: number;
  numberNotation?: string;
  width?: number;
  height?: number;
  layouts?: Partial<Record<RecoveryLayoutMode, RecoveryRect>>;
  kind?: string;
  copyOf?: string;
  definition?: Record<string, unknown>;
  savedDefinition?: Record<string, unknown>;
  metricId?: number;
  chart?: string;
  dimension?: string;
};

export type RecoveryUnit<T extends RecoveryItem> = { title: string; items: T[] };

export type RecoveryConflict = { key?: string; label: string };

export type RecoveryPlan<T extends RecoveryItem> = {
  same: boolean;
  structural: boolean;
  conflicts: RecoveryConflict[];
  merged: { title: string; items: T[] };
};

/** Confirmation token for the dashboard title, which has no block key. */
export const RECOVERY_DASHBOARD_TITLE_KEY = '__dashboard_title__';

type PresentationField = 'title' | 'unit' | 'decimalPlaces' | 'numberNotation' | 'width' | 'height';

type CanonRect = { x: number | null; y: number | null; w: number | null; h: number | null };

type Canonical = {
  title: string;
  unit: string;
  decimalPlaces: number;
  numberNotation: 'plain' | 'compact';
  width: number | null;
  height: number | null;
  layouts: Record<RecoveryLayoutMode, CanonRect | null>;
};

type ActualFields = {
  sql: unknown;
  type: unknown;
  valueField: unknown;
  categoryField: unknown;
  description: unknown;
  prefix: unknown;
};

const PRESENTATION_FIELDS: ReadonlyArray<{ field: PresentationField; label: string }> = [
  { field: 'title', label: '제목' },
  { field: 'unit', label: '단위' },
  { field: 'decimalPlaces', label: '소수 자릿수' },
  { field: 'numberNotation', label: '표기 방식' },
  { field: 'width', label: '너비' },
  { field: 'height', label: '높이' },
];

const LAYOUT_MODES: readonly RecoveryLayoutMode[] = ['mobile', 'tablet', 'desktop'];

const LAYOUT_LABELS: Record<RecoveryLayoutMode, string> = {
  mobile: '모바일 배치',
  tablet: '태블릿 배치',
  desktop: '데스크톱 배치',
};

const DEFINITION_LABEL = '계산/차트 정의';

const DASHBOARD_TITLE_LABEL = '대시보드 제목 · 제목';

const MODEL_FIELDS = ['kind', 'copyOf', 'definition', 'savedDefinition', 'metricId', 'chart', 'dimension'] as const;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const raw = (item: RecoveryItem): Record<string, unknown> => item as unknown as Record<string, unknown>;

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Key-order independent encoding. A missing field never equals a present value. */
const stable = (value: unknown): string => {
  if (value === undefined) return '\u0000missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'number') return `n:${value}`;
  if (typeof value === 'string') return `s:${value}`;
  return `${typeof value}:${String(value)}`;
};

const canonRect = (value: unknown): CanonRect | null => {
  const rect = asRecord(value);
  if (!rect) return null;
  return {
    x: num(rect.x) ?? null,
    y: num(rect.y) ?? null,
    w: num(rect.w) ?? null,
    h: num(rect.h) ?? null,
  };
};

/** A draft is a materialized SQL block; without a draft it keeps the stored binding kind. */
const canonicalKind = (source: Record<string, unknown>): string => {
  if (source.kind === 'draft') return 'existing';
  if (source.kind === 'metric') return 'metric';
  return 'existing';
};

/** Actual definition: the draft definition for drafts, else the server-provided saved widget. */
const canonicalDefinition = (source: Record<string, unknown>): Record<string, unknown> | undefined =>
  asRecord(source.kind === 'draft' ? source.definition : source.savedDefinition);

/** Actual content of a unit: the SQL snapshot fields a server save would persist. */
const actualFields = (source: Record<string, unknown>): ActualFields | undefined => {
  const definition = canonicalDefinition(source);
  if (
    !definition ||
    typeof definition.sql !== 'string' ||
    !definition.sql.trim() ||
    typeof definition.type !== 'string' ||
    !definition.type ||
    typeof definition.valueField !== 'string' ||
    !definition.valueField
  )
    return undefined;
  return {
    sql: definition.sql,
    type: definition.type,
    valueField: definition.valueField,
    categoryField: definition.categoryField,
    description: definition.description,
    prefix: definition.prefix,
  };
};

/**
 * Model group for one side of a comparison.
 *
 * `kind` is only neutralized for a materialized draft whose actual content matches the other side:
 * that is the draft/materialization difference, and it must not read as a change. A metric binding
 * that flips to `existing` keeps its own kind even with an identical SQL string, so a deactivated
 * metric is never mistaken for no change. `metricId` counts only while both sides are metric
 * bindings, so a leftover id on a materialized draft cannot invent a binding the server never had.
 */
const comparableModel = (source: Record<string, unknown>, other: Record<string, unknown>) => {
  const actual = actualFields(source);
  const otherActual = actualFields(other);
  const actualMatches = actual !== undefined && otherActual !== undefined && stable(actual) === stable(otherActual);
  const materialized = actualMatches && (source.kind === 'draft' || other.kind === 'draft');
  const bothMetric = source.kind === 'metric' && other.kind === 'metric';
  return {
    actual: actual ?? null,
    kind: materialized ? null : canonicalKind(source),
    metricId: bothMetric ? num(source.metricId) ?? null : null,
    copyOf: source.copyOf ?? null,
    chart: source.chart ?? null,
    dimension: source.dimension ?? null,
  };
};

/** True when two units describe the same binding and the same actual content. */
const modelEquivalent = (left: Record<string, unknown>, right: Record<string, unknown>): boolean =>
  stable(comparableModel(left, right)) === stable(comparableModel(right, left));

const canonical = (item: RecoveryItem): Canonical => {
  const source = raw(item);
  const layouts = asRecord(source.layouts) ?? {};
  return {
    title: String(source.title ?? '').trim(),
    unit: String(source.unit ?? '').trim(),
    decimalPlaces: num(source.decimalPlaces) ?? 0,
    numberNotation: source.numberNotation === 'compact' ? 'compact' : 'plain',
    width: num(source.width) ?? null,
    height: num(source.height) ?? null,
    layouts: {
      mobile: canonRect(layouts.mobile),
      tablet: canonRect(layouts.tablet),
      desktop: canonRect(layouts.desktop),
    },
  };
};

const applyLayout = (target: Record<string, unknown>, source: Record<string, unknown>, mode: RecoveryLayoutMode): void => {
  const sourceLayouts = asRecord(source.layouts) ?? {};
  const next: Record<string, unknown> = { ...(asRecord(target.layouts) ?? {}) };
  if (sourceLayouts[mode] === undefined) delete next[mode];
  else next[mode] = sourceLayouts[mode];
  target.layouts = next;
};

/**
 * Copies the model group from `source`. With `keepTargetDefinition` a missing canonical definition
 * on the source never overwrites the target snapshot, so a partially known local unit cannot drop
 * the latest saved SQL before the next preview.
 */
const copyModel = (target: Record<string, unknown>, source: Record<string, unknown>, keepTargetDefinition = false): void => {
  for (const field of MODEL_FIELDS) {
    if (field === 'savedDefinition' && keepTargetDefinition && canonicalDefinition(source) === undefined) continue;
    target[field] = source[field];
  }
};

const keysMatch = (left: RecoveryItem[], right: RecoveryItem[]): boolean =>
  left.length === right.length && left.every((item, index) => item?.key === right[index]?.key);

const duplicatedKeys = (items: RecoveryItem[]): boolean => new Set(items.map(item => item?.key)).size !== items.length;

export function recoveryPlan<T extends RecoveryItem>(
  base: RecoveryUnit<T>,
  local: RecoveryUnit<T>,
  latest: RecoveryUnit<T>,
  confirmedKeys: readonly string[] = [],
): RecoveryPlan<T> {
  const structural =
    !keysMatch(base.items, local.items) ||
    !keysMatch(local.items, latest.items) ||
    duplicatedKeys(base.items) ||
    duplicatedKeys(local.items) ||
    duplicatedKeys(latest.items);
  if (structural)
    return {
      same: false,
      structural: true,
      conflicts: [],
      merged: { title: latest.title, items: latest.items.map(item => ({ ...item })) },
    };

  const confirmed = new Set(confirmedKeys);
  const conflicts: RecoveryConflict[] = [];
  const mergedItems: T[] = [];
  let same = local.title === latest.title;

  let title = latest.title;
  const titleLocalChanged = local.title !== base.title;
  const titleLatestChanged = latest.title !== base.title;
  if (titleLocalChanged && !titleLatestChanged) title = local.title;
  else if (titleLocalChanged && titleLatestChanged && local.title !== latest.title) {
    title = confirmed.has(RECOVERY_DASHBOARD_TITLE_KEY) ? local.title : latest.title;
    conflicts.push({ label: DASHBOARD_TITLE_LABEL });
  }

  for (let index = 0; index < latest.items.length; index += 1) {
    const baseItem = base.items[index];
    const localItem = local.items[index];
    const latestItem = latest.items[index];
    const baseCanon = canonical(baseItem);
    const localCanon = canonical(localItem);
    const latestCanon = canonical(latestItem);
    if (stable(localCanon) !== stable(latestCanon)) same = false;

    const baseRaw = raw(baseItem);
    const localRaw = raw(localItem);
    const latestRaw = raw(latestItem);
    if (!actualFields(localRaw) || !actualFields(latestRaw) || !modelEquivalent(localRaw, latestRaw)) same = false;
    const merged: Record<string, unknown> = { ...latestRaw };
    const confirmedUnit = confirmed.has(latestItem.key);
    const fields: string[] = [];

    for (const { field, label } of PRESENTATION_FIELDS) {
      const baseValue = baseCanon[field] as unknown;
      const localValue = localCanon[field] as unknown;
      const latestValue = latestCanon[field] as unknown;
      if (stable(localValue) === stable(baseValue)) continue;
      if (stable(latestValue) === stable(baseValue)) {
        merged[field] = localRaw[field];
        continue;
      }
      if (stable(localValue) === stable(latestValue)) continue;
      fields.push(label);
      if (confirmedUnit) merged[field] = localRaw[field];
    }

    for (const mode of LAYOUT_MODES) {
      const baseValue = baseCanon.layouts[mode];
      const localValue = localCanon.layouts[mode];
      const latestValue = latestCanon.layouts[mode];
      if (stable(localValue) === stable(baseValue)) continue;
      if (stable(latestValue) === stable(baseValue)) {
        applyLayout(merged, localRaw, mode);
        continue;
      }
      if (stable(localValue) === stable(latestValue)) continue;
      fields.push(LAYOUT_LABELS[mode]);
      if (confirmedUnit) applyLayout(merged, localRaw, mode);
    }

    const modelLocalChanged = !modelEquivalent(localRaw, baseRaw);
    if (modelLocalChanged) {
      const modelLatestChanged = !modelEquivalent(latestRaw, baseRaw);
      // A missing canonical definition can never be assumed equal to a present one (BR-017-02), so
      // such a unit needs the explicit confirmation instead of a silent local win.
      const unverifiable = actualFields(localRaw) === undefined || actualFields(latestRaw) === undefined;
      if (!modelLatestChanged && !unverifiable) copyModel(merged, localRaw);
      else if (unverifiable || !modelEquivalent(localRaw, latestRaw)) {
        fields.push(DEFINITION_LABEL);
        if (confirmedUnit) copyModel(merged, localRaw, true);
      }
    }

    if (fields.length > 0) {
      const labelTitle = String(latestRaw.title ?? localRaw.title ?? '');
      conflicts.push({
        key: String(latestItem.key),
        label: `${index + 1}. ${labelTitle} \u00b7 ${fields.join(', ')}`,
      });
    }
    mergedItems.push(merged as unknown as T);
  }

  return { same, structural: false, conflicts, merged: { title, items: mergedItems } };
}
