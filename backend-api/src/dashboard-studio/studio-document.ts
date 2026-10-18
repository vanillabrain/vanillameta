import { validateExploreViewState } from '../bi/explore-view-state';
import { normalizeBusinessBasis } from '../bi/semantic-business-basis';
import { validateConditionSemantics } from '../bi/business-condition-semantics';
import { validateConditionDefinition } from '../bi/source-condition-definition';
import {
  isStudioId,
  STUDIO_BREAKPOINTS,
  STUDIO_COLUMNS,
  StudioDocumentV1,
  StudioLayoutItem,
  StudioFilter,
  StudioDateRange,
  StudioConditions,
} from './studio-contract';
import { dateRangeBounds, validateDateRange } from '../ai/dashboard-date-range';

export type StudioReferenceContext = {
  sourceId: number;
  sourceSchemaVersion: string;
  definitionKeys: Set<string>;
  measureVersions: Map<number, string>;
  dimensionKeys: Set<string>;
};

export function studioAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Restrict each protocol object independently, including nested input objects. */
export function studioKeys(
  value: unknown,
  allowed: readonly string[],
): asserts value is Record<string, unknown> {
  studioAssert(
    value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
      Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)),
    'Unsupported Studio fields or object.',
  );
}

function text(value: unknown, max: number, empty = false): void {
  studioAssert(
    typeof value === 'string' && value.length <= max && (empty || !!value.trim()),
    'Invalid Studio text.',
  );
}

function positiveId(value: unknown): void {
  studioAssert(Number.isSafeInteger(value) && Number(value) > 0, 'Invalid Studio reference ID.');
}

function overlap(a: StudioLayoutItem, b: StudioLayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Categorical scope only; schema authorization is performed by the query boundary. */
export function validateStudioFilters(input: unknown): StudioFilter[] {
  studioAssert(Array.isArray(input) && input.length <= 5, 'Studio supports at most five filters.');
  const seen = new Set<string>();
  for (const filter of Array.from(input)) {
    studioKeys(filter, ['column', 'values']);
    text(filter.column, 128);
    studioAssert(!seen.has(filter.column as string), 'Duplicate Studio filter column.');
    seen.add(filter.column as string);
    studioAssert(
      Array.isArray(filter.values) && filter.values.length > 0 && filter.values.length <= 50,
      'Studio supports one to fifty values per filter.',
    );
    const keys = new Set<string>();
    for (const value of Array.from(filter.values)) {
      studioAssert(
        value === null ||
          typeof value === 'boolean' ||
          (typeof value === 'string' && value.length <= 2000) ||
          (typeof value === 'number' && Number.isFinite(value)),
        'Invalid Studio filter value.',
      );
      const key = JSON.stringify([typeof value, value]);
      studioAssert(!keys.has(key), 'Duplicate Studio filter value.');
      keys.add(key);
    }
  }
  return JSON.parse(JSON.stringify(input));
}

/**
 * Shared date-range contract plus its half-open bounds, so a stored range with an unresolvable
 * business calendar or overflow fails closed instead of silently querying an unintended period.
 */
export function validateStudioDateRange(input: unknown): StudioDateRange {
  const range = validateDateRange(input);
  dateRangeBounds(range);
  return range;
}

/** Stored copy with a pinned immutable file; actual schema is checked before execution. */
export function validateStudioConditions(input: unknown): StudioConditions {
  studioKeys(input, ['sourceRevision', 'definition', 'semantics']);
  studioAssert(
    typeof input.sourceRevision === 'string' && /^[a-f0-9]{64}$/.test(input.sourceRevision),
    'Invalid condition source revision.',
  );
  return {
    sourceRevision: input.sourceRevision,
    definition: validateConditionDefinition(input.definition),
    ...(input.semantics === undefined
      ? {}
      : { semantics: validateConditionSemantics(input.semantics) }),
  };
}

/** Structural protocol validation only; does not assert authorization or live availability. */
export function validateStudioDocument(input: unknown): StudioDocumentV1 {
  studioKeys(input, [
    'schemaVersion',
    'dashboardId',
    'revision',
    'title',
    'sourceId',
    'blocks',
    'layouts',
    'filters',
    'dateRange',
    'conditions',
    'businessBasis',
  ]);
  const doc = input as unknown as StudioDocumentV1;
  studioAssert(doc.schemaVersion === 1, 'Unsupported Studio schema version.');
  positiveId(doc.sourceId);
  if (doc.businessBasis !== undefined) normalizeBusinessBasis(doc.businessBasis);
  if (doc.conditions !== undefined) validateStudioConditions(doc.conditions);
  if (doc.filters !== undefined) validateStudioFilters(doc.filters);
  if (doc.dateRange !== undefined) validateStudioDateRange(doc.dateRange);
  text(doc.title, 300);
  if (doc.dashboardId !== undefined) positiveId(doc.dashboardId);
  if (doc.revision !== undefined) {
    studioAssert(
      typeof doc.revision === 'string' && /^[a-f0-9]{64}$/.test(doc.revision),
      'Invalid Studio revision.',
    );
  }
  studioAssert(
    Array.isArray(doc.blocks) && doc.blocks.length <= 6,
    'Studio supports at most six blocks.',
  );
  const ids = new Set<string>();
  for (const block of doc.blocks) {
    studioKeys(block, [
      'id',
      'pivot',
      'businessBasis',
      'defaultDateColumn',
      'kind',
      'definitionKey',
      'title',
      'description',
      'measureRefs',
      'dimensionRefs',
      'display',
    ]);
    if (block.businessBasis !== undefined) normalizeBusinessBasis(block.businessBasis);
    if (block.defaultDateColumn !== undefined) {
      studioAssert(
        block.kind === 'BOARD_NUMERIC',
        'Only numeric blocks carry a default trend date.',
      );
      if (block.defaultDateColumn !== null) text(block.defaultDateColumn, 255);
    }
    studioAssert(
      isStudioId(block.id) && !ids.has(block.id),
      'Invalid or duplicate Studio block ID.',
    );
    ids.add(block.id);
    studioAssert(
      ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE', 'SEGMENT_PIVOT'].includes(
        block.kind,
      ),
      'Unsupported Studio block kind.',
    );
    text(block.definitionKey, 128);
    studioAssert(/^[A-Za-z0-9:_-]+$/.test(block.definitionKey), 'Invalid Studio definition key.');
    text(block.title, 300);
    text(block.description, 1000, true);
    studioAssert(
      Array.isArray(block.measureRefs) && block.measureRefs.length <= 6,
      'Invalid Studio measure references.',
    );
    studioAssert(
      Array.isArray(block.dimensionRefs) && block.dimensionRefs.length <= 6,
      'Invalid Studio dimension references.',
    );
    const measureIds = new Set<number>();
    for (const measure of block.measureRefs) {
      studioKeys(measure, ['id', 'definitionVersion']);
      positiveId(measure.id);
      text(measure.definitionVersion, 128);
      studioAssert(!measureIds.has(measure.id), 'Duplicate Studio measure reference.');
      measureIds.add(measure.id);
    }
    const dimensionKeys = new Set<string>();
    for (const dimension of block.dimensionRefs) {
      studioKeys(dimension, ['key', 'sourceId', 'schemaVersion', 'businessBasis']);
      if (dimension.businessBasis !== undefined) {
        const basis = normalizeBusinessBasis(dimension.businessBasis);
        studioAssert(
          basis.columns.length === 1 && basis.columns[0].column === dimension.key,
          'Invalid Studio dimension business basis.',
        );
      }
      text(dimension.key, 255);
      text(dimension.schemaVersion, 128);
      studioAssert(
        dimension.sourceId === doc.sourceId && !dimensionKeys.has(dimension.key),
        'Invalid source or duplicate Studio dimension reference.',
      );
      dimensionKeys.add(dimension.key);
    }
    if (block.kind === 'SEGMENT_PIVOT') {
      studioKeys(block.pivot, ['revision', 'state']);
      studioAssert(
        typeof block.pivot.revision === 'string' && /^[a-f0-9]{64}$/.test(block.pivot.revision),
        'Invalid Pivot revision.',
      );
      const state = block.pivot.state;
      studioAssert(
        state?.mode === 'segment' && !!state.segment?.pivotColumn && state.conditions === undefined,
        'SEGMENT_PIVOT_UNSUPPORTED: row AST composition is unsupported.',
      );
      validateExploreViewState(state, {
        sourceRevision: '',
        measures: block.measureRefs.map(r => ({ id: r.id })),
        dimensions: block.dimensionRefs
          .map(r => ({ column: r.key, type: 'VARCHAR', numeric: false }))
          .concat(
            (state.filters ?? [])
              .filter(f => !block.dimensionRefs.some(r => r.key === f.column))
              .map(f => ({ column: f.column, type: 'VARCHAR', numeric: false })),
            state.dateRange &&
              !block.dimensionRefs.some(r => r.key === state.dateRange.column) &&
              !(state.filters ?? []).some(f => f.column === state.dateRange.column)
              ? [{ column: state.dateRange.column, type: 'TIMESTAMP', numeric: false }]
              : [],
          ),
        temporalColumns: state.dateRange ? [{ column: state.dateRange.column }] : [],
      });
      studioAssert(
        !doc.conditions &&
          block.businessBasis === undefined &&
          block.display.presentation === undefined &&
          block.display.timeGrain === undefined,
        'SEGMENT_PIVOT_UNSUPPORTED: preserve the saved Pivot recipe.',
      );
    } else studioAssert(block.pivot === undefined, 'Only Pivot blocks carry a Pivot recipe.');
    studioKeys(block.display, [
      'decimalPlaces',
      'numberNotation',
      'prefix',
      'suffix',
      'timeGrain',
      'presentation',
    ]);
    const display = block.display;
    if (display.presentation !== undefined)
      studioAssert(
        display.presentation === 'visual' ||
          (display.presentation === 'summary' && block.kind === 'BOARD_NUMERIC') ||
          (display.presentation === 'table' && block.kind !== 'BOARD_NUMERIC'),
        'Invalid Studio report presentation.',
      );
    if (display.timeGrain !== undefined)
      studioAssert(
        block.kind === 'CHART_LINE' && ['auto', 'day', 'week', 'month'].includes(display.timeGrain),
        'Invalid Studio time grain.',
      );
    if (display.decimalPlaces !== undefined) {
      studioAssert(
        Number.isSafeInteger(display.decimalPlaces) &&
          display.decimalPlaces >= 0 &&
          display.decimalPlaces <= 6,
        'Invalid Studio decimal places.',
      );
    }
    if (display.numberNotation !== undefined) {
      studioAssert(
        ['full', 'compact'].includes(display.numberNotation),
        'Invalid Studio number notation.',
      );
    }
    if (display.prefix !== undefined) text(display.prefix, 100, true);
    if (display.suffix !== undefined) text(display.suffix, 100, true);
  }
  studioKeys(doc.layouts, STUDIO_BREAKPOINTS);
  for (const breakpoint of STUDIO_BREAKPOINTS) {
    const items = doc.layouts[breakpoint];
    studioAssert(
      Array.isArray(items) && items.length === ids.size,
      'Studio layouts must match all blocks.',
    );
    const seen = new Set<string>();
    Array.from(items).forEach((item, index) => {
      studioKeys(item, ['id', 'x', 'y', 'w', 'h']);
      studioAssert(
        ids.has(item.id) && !seen.has(item.id),
        'Invalid or duplicate Studio layout ID.',
      );
      seen.add(item.id);
      studioAssert(
        [item.x, item.y, item.w, item.h].every(Number.isSafeInteger) &&
          item.x >= 0 &&
          item.y >= 0 &&
          item.w > 0 &&
          item.h > 0 &&
          item.x + item.w <= STUDIO_COLUMNS[breakpoint] &&
          Number.isSafeInteger(item.y + item.h),
        'Studio layout exceeds safe integer or grid bounds.',
      );
      studioAssert(
        items.slice(0, index).every(other => !overlap(item, other)),
        'Studio layouts collide.',
      );
    });
  }
  return JSON.parse(JSON.stringify(doc)) as StudioDocumentV1;
}

/** Caller supplies authoritative reference metadata; authorization remains outside this helper. */
export function assertStudioReferences(
  doc: StudioDocumentV1,
  context: StudioReferenceContext,
): void {
  const validated = validateStudioDocument(doc);
  studioAssert(validated.sourceId === context.sourceId, 'Studio source reference mismatch.');
  for (const block of validated.blocks) {
    studioAssert(
      context.definitionKeys.has(block.definitionKey),
      'Unknown Studio definition reference.',
    );
    for (const measure of block.measureRefs) {
      studioAssert(
        context.measureVersions.has(measure.id) &&
          context.measureVersions.get(measure.id) === measure.definitionVersion,
        'Unknown or mismatched Studio measure version.',
      );
    }
    for (const dimension of block.dimensionRefs) {
      studioAssert(
        dimension.sourceId === context.sourceId &&
          context.dimensionKeys.has(dimension.key) &&
          dimension.schemaVersion === context.sourceSchemaVersion,
        'Unknown or mismatched Studio dimension reference.',
      );
    }
  }
}
