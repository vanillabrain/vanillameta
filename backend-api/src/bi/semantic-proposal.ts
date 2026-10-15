import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { metricFields } from './metric-expression';
import { compileMetricWidget } from './structured-widget';

const fail = () => {
  throw new BadRequestException('지표·분류·차트 제안을 확인해 주세요.');
};
export function shape(value: any, allowed: string[], required = allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(k => !allowed.includes(k)) ||
    required.some(k => !Object.prototype.hasOwnProperty.call(value, k))
  )
    fail();
}
function text(value: any, limit: number, empty = false) {
  if (typeof value !== 'string' || value.length > limit || (!empty && !value.trim())) fail();
  return value.trim();
}
function key(value: any) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) fail();
  return value;
}
function list(value: any, empty = false): any[] {
  if (!Array.isArray(value) || value.length > 6 || (!empty && !value.length)) fail();
  const keys = value.map(v => key(v?.key));
  if (new Set(keys).size !== keys.length) fail();
  return value;
}
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(k => [k, canonical(value[k])]),
      )
    : value;
export const semanticDigest = (value: any) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
export function normalizeMetric(value: any, profile: any) {
  const base = ['label', 'aggregation', 'column', 'unit', 'decimalPlaces', 'numberNotation'];
  const extra =
    value?.aggregation === 'RATIO_SUM'
      ? ['denominatorColumn', 'scale']
      : value?.aggregation === 'WEIGHTED_AVG'
      ? ['weightColumn']
      : [];
  shape(value, [...base, ...extra]);
  if (
    !Number.isInteger(value.decimalPlaces) ||
    value.decimalPlaces < 0 ||
    value.decimalPlaces > 6 ||
    !['plain', 'compact'].includes(value.numberNotation)
  )
    fail();
  if (value.aggregation === 'COUNT' && value.column !== '*') fail();
  return {
    label: text(value.label, 100),
    aggregation: value.aggregation,
    ...metricFields(value, profile),
    unit: text(value.unit, 12, true),
    decimalPlaces: value.decimalPlaces,
    numberNotation: value.numberNotation,
  };
}
export function metricIdentity(definition: any, sourceId: number) {
  const calculation = { ...definition };
  delete calculation.label;
  delete calculation.decimalPlaces;
  delete calculation.numberNotation;
  return semanticDigest({ sourceId, tableName: 'uploaded_data', ...calculation });
}
export function dimensionDefinition(profile: any, column: any) {
  return {
    id: 'dim_' + semanticDigest({ sourceId: profile.sourceId, column: column.name }),
    definitionVersion: 1,
    column: column.name,
    type: column.type,
    label: column.name,
  };
}
/** Invalid/inactive/foreign definitions are never candidates; no read repairs persisted rows. */
export function semanticCatalog(rows: any[], profile: any) {
  return rows
    .flatMap(row => {
      try {
        const d = JSON.parse(row.definition);
        if (
          row.useYn !== 'Y' ||
          row.databaseId !== profile.sourceId ||
          d.schemaVersion !== 1 ||
          d.sourceId !== profile.sourceId ||
          d.tableName !== 'uploaded_data' ||
          !Number.isSafeInteger(d.definitionVersion) ||
          d.definitionVersion < 1 ||
          !Number.isSafeInteger(row.id) ||
          row.id < 1
        )
          return [];
        const fields = { ...d };
        for (const k of ['schemaVersion', 'definitionVersion', 'sourceId', 'tableName'])
          delete fields[k];
        const definitionVersion = d.definitionVersion;
        const definition = normalizeMetric(fields, profile);
        return [
          {
            id: row.id,
            definitionVersion,
            definition,
            identity: metricIdentity(definition, profile.sourceId),
          },
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.id - b.id);
}
export function compileSemanticProposal(
  input: any,
  profile: any,
  catalog: ReturnType<typeof semanticCatalog>,
) {
  if (Buffer.byteLength(JSON.stringify(input) ?? '') > 128 * 1024) fail();
  shape(input, [
    'schemaVersion',
    'sourceId',
    'sourceRevision',
    'title',
    'measures',
    'dimensions',
    'blocks',
  ]);
  if (input.schemaVersion !== 1 || input.sourceId !== profile.sourceId || !profile.supported)
    fail();
  if (input.sourceRevision !== profile.dataVersion)
    throw new ConflictException('원본이 변경되었습니다. 다시 제안·미리보기해 주세요.');
  const aliases = new Map<string, string>();
  const definitions = new Map<string, any>();
  const measures: any[] = [],
    measurePlan: any[] = [];
  for (const measure of list(input.measures)) {
    const hasReuse = Object.prototype.hasOwnProperty.call(measure, 'reuse');
    shape(measure, hasReuse ? ['key', 'reuse'] : ['key', 'definition']);
    let definition: any, reference: any;
    if (measure.reuse) {
      shape(measure.reuse, ['metricId', 'definitionVersion']);
      reference = catalog.find(c => c.id === measure.reuse.metricId);
      if (!reference) fail();
      if (reference.definitionVersion !== measure.reuse.definitionVersion)
        throw new ConflictException('저장 지표가 변경되었습니다. 다시 미리보기해 주세요.');
      definition = reference.definition;
    } else definition = normalizeMetric(measure.definition, profile);
    const identity = metricIdentity(definition, profile.sourceId);
    const prior = measurePlan.find(
      m =>
        m.identity === identity &&
        semanticDigest(m.definition) === semanticDigest(definition) &&
        (!measure.reuse || m.metricId === reference.id),
    );
    if (prior) {
      aliases.set(measure.key, prior.key);
      continue;
    }
    reference ??= catalog.find(c => c.identity === identity);
    aliases.set(measure.key, measure.key);
    definitions.set(measure.key, definition);
    measures.push({
      key: measure.key,
      ...(measure.reuse
        ? { reuse: { metricId: reference.id, definitionVersion: reference.definitionVersion } }
        : { definition }),
    });
    measurePlan.push({
      key: measure.key,
      identity,
      action: reference ? 'reuse' : 'create',
      ...(reference
        ? { metricId: reference.id, definitionVersion: reference.definitionVersion }
        : {}),
      definition,
    });
  }
  const dimensions = list(input.dimensions, true).map(d => {
    shape(d, ['key', 'column']);
    const column = profile.columns.find(c => c.name === d.column);
    if (!column) fail();
    return { key: d.key, column: column.name };
  });
  const dimensionPlan = dimensions.map(d => ({
    ...d,
    ...dimensionDefinition(
      profile,
      profile.columns.find(c => c.name === d.column),
    ),
  }));
  const usedMeasures = new Set<string>(),
    usedDimensions = new Set<string>();
  const blocks = list(input.blocks).map(b => {
    shape(
      b,
      ['key', 'measureKey', 'dimensionKey', 'chart', 'title'],
      ['key', 'measureKey', 'chart', 'title'],
    );
    const measureKey = aliases.get(b.measureKey);
    if (!measureKey || !['number', 'bar', 'line'].includes(b.chart)) fail();
    const dimension = dimensions.find(d => d.key === b.dimensionKey);
    if (
      (b.chart === 'number' && b.dimensionKey !== undefined) ||
      (b.chart !== 'number' && !dimension)
    )
      fail();
    usedMeasures.add(measureKey);
    if (dimension) usedDimensions.add(dimension.key);
    return {
      key: b.key,
      measureKey,
      ...(dimension ? { dimensionKey: dimension.key } : {}),
      chart: b.chart,
      title: text(b.title, 300),
    };
  });
  if (
    measures.some(m => !usedMeasures.has(m.key)) ||
    dimensions.some(d => !usedDimensions.has(d.key))
  )
    fail();
  const proposal = {
    schemaVersion: 1,
    sourceId: profile.sourceId,
    sourceRevision: profile.dataVersion,
    title: text(input.title, 300),
    measures,
    dimensions,
    blocks,
  };
  const plan = { measures: measurePlan, dimensions: dimensionPlan };
  const draft = {
    databaseId: profile.sourceId,
    title: proposal.title,
    explanation: '구조화 지표·분류 제안',
    widgets: blocks.map(
      b =>
        compileMetricWidget(
          definitions.get(b.measureKey),
          profile,
          b.chart,
          dimensions.find(d => d.key === b.dimensionKey)?.column,
          b.title,
        ).widget,
    ),
  };
  return {
    proposal,
    plan,
    draft,
    previewDigest: semanticDigest({ proposal, plan }),
    categoryLimit: 500,
  };
}
