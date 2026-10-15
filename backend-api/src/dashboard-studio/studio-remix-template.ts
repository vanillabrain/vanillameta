import { quoteColumn } from '../ai/dashboard-draft';
import { metricExpression, metricFields } from '../bi/metric-expression';
import { StudioDocumentV1, STUDIO_BREAKPOINTS } from './studio-contract';
import { RemixTemplate } from './studio-remix-contract';

export function canonicalMetricSql(
  metric: any,
  kind: string,
  dimensionColumn: string | undefined,
  profile: any,
): string {
  const dimension = dimensionColumn ? quoteColumn(dimensionColumn) : undefined;
  return `SELECT ${dimension ? dimension + ' AS dimension, ' : ''}${metricExpression(
    metric,
    profile,
  )} AS value FROM source${
    dimension
      ? ' GROUP BY ' +
        dimension +
        ' ORDER BY ' +
        (kind === 'CHART_LINE' ? 'dimension' : 'value DESC') +
        ' LIMIT 500'
      : ''
  }`;
}
/** Capture only explicit canonical links. SQL is never parsed into guessed semantics. */
export function captureRemixTemplate(
  document: StudioDocumentV1,
  items: any[],
  schema: any[],
  widgets: any[],
): RemixTemplate {
  const columns = schema.map(c => ({
    name: c.column_name,
    type: c.column_type,
    numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
      c.column_type,
    ),
    temporal: /^(DATE|TIMESTAMP)/i.test(c.column_type),
  }));
  const required = new Map<string, { name: string; type: string; blockIds: string[] }>();
  const ids = new Map(document.blocks.map((b, i) => [b.id, 'block-' + (i + 1)]));
  const blocks = document.blocks.map((block, index) => {
    const base = {
      id: ids.get(block.id),
      title: block.title,
      description: block.description,
      kind: block.kind,
      display: { ...block.display },
    };
    try {
      const item = items[index],
        d = item?.definition;
      if (
        !d ||
        d.schemaVersion !== 1 ||
        d.sourceId !== document.sourceId ||
        item.sourceId !== document.sourceId ||
        item.definitionVersion !== d.definitionVersion ||
        !Number.isSafeInteger(d.definitionVersion) ||
        d.definitionVersion < 1 ||
        block.measureRefs.length !== 1 ||
        block.measureRefs[0].id !== item.metricId ||
        block.measureRefs[0].definitionVersion !== String(item.definitionVersion) ||
        d.tableName !== 'uploaded_data'
      )
        throw new Error();
      const fields = metricFields(d, { columns });
      const dimension =
        block.kind === 'BOARD_NUMERIC' ? undefined : columns.find(c => c.name === item.dimension);
      if (
        (block.kind !== 'BOARD_NUMERIC' &&
          (!dimension ||
            block.dimensionRefs.length !== 1 ||
            block.dimensionRefs[0].key !== dimension.name)) ||
        (block.kind === 'CHART_LINE' && !dimension?.temporal)
      )
        throw new Error();
      const widget = widgets[index];
      if (
        !widget ||
        widget.type !== block.kind ||
        widget.valueField !== 'value' ||
        (dimension && widget.categoryField !== 'dimension') ||
        widget.sql !== canonicalMetricSql(d, block.kind, dimension?.name, { columns })
      )
        throw new Error();
      if (
        typeof d.label !== 'string' ||
        !d.label.trim() ||
        d.label.length > 100 ||
        typeof d.unit !== 'string' ||
        d.unit.length > 12 ||
        !Number.isInteger(d.decimalPlaces) ||
        d.decimalPlaces < 0 ||
        d.decimalPlaces > 6 ||
        !['plain', 'compact'].includes(d.numberNotation)
      )
        throw new Error();
      const names = [
        ...(d.aggregation === 'COUNT' ? [] : [fields.column]),
        fields.denominatorColumn,
        fields.weightColumn,
        dimension?.name,
      ].filter(Boolean);
      for (const name of new Set<string>(names)) {
        const column = columns.find(c => c.name === name);
        const field = required.get(name) ?? { name, type: column.type, blockIds: [] };
        field.blockIds.push(base.id);
        required.set(name, field);
      }
      return {
        ...base,
        supported: true,
        metric: {
          label: d.label,
          aggregation: d.aggregation,
          ...fields,
          unit: d.unit,
          decimalPlaces: d.decimalPlaces,
          numberNotation: d.numberNotation,
        },
        ...(dimension ? { dimension: { column: dimension.name } } : {}),
      };
    } catch {
      return {
        ...base,
        supported: false,
        reason: '저장된 구조화 지표와 분류로 확인할 수 없는 블록입니다.',
      };
    }
  });
  return {
    schemaVersion: 1,
    title: document.title,
    requiredFields: [...required.values()],
    blocks,
    layouts: Object.fromEntries(
      STUDIO_BREAKPOINTS.map(bp => [
        bp,
        document.layouts[bp].map(g => ({ ...g, id: ids.get(g.id) })),
      ]),
    ) as RemixTemplate['layouts'],
  };
}
