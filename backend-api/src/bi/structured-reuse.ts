import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Metric } from '../metric/entities/metric.entity';
import { metricLinkItems } from '../ai/metric-analysis-links';
import { canonicalMetricSql } from '../dashboard-studio/studio-remix-template';
import { metricExpression } from './metric-expression';
import { normalizeFormulaUnit, pinMetricFormula } from './metric-formula';

type Node = { id: number; definition: any };
export type StructuredReusePlan = {
  nodes: Node[];
  items: Array<{ nodeId?: number; dimension?: string; chart?: string }>;
};
const fail = () =>
  new BadRequestException(
    '저장 지표 연결을 안전하게 복제할 수 없습니다. 원본 계산과 열 연결을 확인해 주세요. 기존 지표는 변경하지 않았습니다.',
  );
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** A malformed envelope containing explicit links is not an unlinked legacy dashboard. */
function checkedReuseLinks(snapshot: any, analysis: any): any[] {
  const items = metricLinkItems(snapshot, analysis);
  if (!snapshot) return items;
  const raw = Array.isArray(snapshot.items) ? snapshot.items : [snapshot];
  const indicated = raw.some(
    item =>
      item &&
      ['metricId', 'definition', 'definitionVersion'].some(key =>
        Object.prototype.hasOwnProperty.call(item, key),
      ),
  );
  if (
    (snapshot.sourceId !== undefined && snapshot.sourceId !== analysis.databaseId) ||
    (indicated && !items.length) ||
    (indicated &&
      snapshot.kind !== 'structured-bi' &&
      Array.isArray(analysis.widgets) &&
      items.length !== analysis.widgets.length)
  )
    throw fail();
  return items;
}

/** Declared money semantics survive a source whose file units are unknown. COUNT units are not money. */
export function declaredReuseCurrency(snapshot: any, analysis: any): string | undefined {
  const units = new Set<string>();
  const visit = (d: any) => {
    if (!d || d.schemaVersion !== 1 || d.sourceId !== analysis.databaseId) return;
    if (d.aggregation === 'FORMULA') {
      for (const o of d.formula?.operands ?? []) visit(o.definition);
      return;
    }
    if (['COUNT', 'COUNT_DISTINCT'].includes(d.aggregation)) return;
    const unit = normalizeFormulaUnit(d.unit);
    if (unit === 'USD' || unit === 'KRW') units.add(unit);
  };
  for (const item of checkedReuseLinks(snapshot, analysis)) visit(item?.definition);
  if (units.size > 1) throw fail();
  return [...units][0];
}

/** Copy explicit frozen canonical links, including leaf formula operands. Never infer from SQL. */
export function prepareStructuredReuse(
  snapshot: any,
  original: any,
  selected: any,
  remapped: any,
  profile: any,
  target: any,
  mapping: Record<string, string>,
): StructuredReusePlan | undefined {
  if (
    !snapshot ||
    (!snapshot.kind &&
      Array.isArray(snapshot.items) &&
      !snapshot.items.length &&
      Object.keys(snapshot).length === 1)
  )
    return;
  const links = checkedReuseLinks(snapshot, original);
  const nodes: Node[] = [];
  const known = new Map<string, Node>();
  const column = (name: string) => {
    const entry = Object.entries(mapping).find(([k]) => k.toLowerCase() === name.toLowerCase());
    if (!entry) throw fail();
    return (
      target.columns.find(c => c.name.toLowerCase() === entry[1].toLowerCase())?.name ??
      (() => {
        throw fail();
      })()
    );
  };
  const add = (id: number, version: number, definition: any): Node => {
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !definition ||
      definition.schemaVersion !== 1 ||
      definition.sourceId !== original.databaseId ||
      definition.tableName !== 'uploaded_data' ||
      definition.definitionVersion !== version
    )
      throw fail();
    const key = JSON.stringify([id, version, definition]);
    const existing = known.get(key);
    if (existing) return existing;
    metricExpression(definition, profile); // Prove the original frozen definition before remapping.
    const next = { ...clone(definition), sourceId: target.sourceId, definitionVersion: 1 };
    delete next.id;
    if (definition.aggregation === 'FORMULA') {
      const operands = definition.formula.operands.map(operand => {
        if (operand.definition.aggregation === 'FORMULA') throw fail();
        return {
          previous: operand,
          node: add(operand.id, operand.definitionVersion, operand.definition),
        };
      });
      const rewrite = (expr: any): any => {
        if ('metricId' in expr) {
          const found = operands.find(
            x =>
              x.previous.id === expr.metricId &&
              x.previous.definitionVersion === expr.definitionVersion,
          );
          if (!found) throw fail();
          return { metricId: found.node.id, definitionVersion: 1 };
        }
        return { ...expr, left: rewrite(expr.left), right: rewrite(expr.right) };
      };
      next.formula = pinMetricFormula(
        rewrite(definition.formula.expression),
        operands.map(x => ({ id: x.node.id, definitionVersion: 1, definition: x.node.definition })),
        target,
      );
    } else if (definition.aggregation !== 'COUNT') {
      for (const field of ['column', 'denominatorColumn', 'weightColumn'])
        if (definition[field]) next[field] = column(definition[field]);
    }
    metricExpression(next, target);
    const node = { id: nodes.length + 1, definition: next };
    nodes.push(node);
    known.set(key, node);
    return node;
  };
  const items = selected.widgets.map((widget, index) => {
    const i = original.widgets.findIndex(w => w.blockId === widget.blockId);
    const item = links[i];
    if (!item || Object.keys(item).every(key => key === 'key')) return {};
    if (item.sourceId !== original.databaseId || (item.key && item.key !== widget.blockId))
      throw fail();
    const dimension = item.dimension;
    if (widget.sql !== canonicalMetricSql(item.definition, widget.type, dimension, profile))
      throw fail();
    const node = add(item.metricId, item.definitionVersion, item.definition);
    const targetDimension = dimension ? column(dimension) : undefined;
    if (
      remapped.widgets[index].sql !==
      canonicalMetricSql(node.definition, widget.type, targetDimension, target)
    )
      throw fail();
    return {
      nodeId: node.id,
      ...(targetDimension ? { dimension: targetDimension } : {}),
      chart:
        item.chart ??
        (widget.type === 'BOARD_NUMERIC'
          ? 'number'
          : widget.type === 'CHART_LINE'
          ? 'line'
          : 'bar'),
    };
  });
  return { nodes, items };
}

/** Called only inside the existing receipt + dashboard transaction. Leaves are saved first. */
export async function persistStructuredReuse(
  plan: StructuredReusePlan,
  sourceId: number,
  dataVersion: string,
  manager: EntityManager,
): Promise<{
  schemaVersion: number;
  kind: string;
  sourceId: number;
  dataVersion: string;
  items: Array<Record<string, any>>;
}> {
  const saved = new Map<number, { id: number; definition: any }>();
  for (const node of plan.nodes) {
    const definition = clone(node.definition);
    if (definition.aggregation === 'FORMULA') {
      const rewrite = (expr: any): any =>
        'metricId' in expr
          ? { metricId: saved.get(expr.metricId).id, definitionVersion: 1 }
          : { ...expr, left: rewrite(expr.left), right: rewrite(expr.right) };
      const operands = definition.formula.operands.map(o => ({
        id: saved.get(o.id).id,
        definitionVersion: 1,
        definition: saved.get(o.id).definition,
      }));
      definition.formula = {
        ...definition.formula,
        expression: rewrite(definition.formula.expression),
        operands,
      };
    }
    const metric = await manager.save(Metric, {
      name: 'bi_' + randomUUID(),
      databaseId: sourceId,
      tableName: 'uploaded_data',
      aggregation: definition.aggregation,
      expression: definition.column ?? 'count_rows',
      description: definition.label,
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    saved.set(node.id, { id: metric.id, definition });
  }
  return {
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    sourceId,
    dataVersion,
    items: plan.items.map(item =>
      item.nodeId === undefined
        ? {}
        : {
            sourceId,
            dataVersion,
            metricId: saved.get(item.nodeId).id,
            definitionVersion: 1,
            definition: saved.get(item.nodeId).definition,
            ...(item.dimension ? { dimension: item.dimension } : {}),
            chart: item.chart,
          },
    ),
  };
}
