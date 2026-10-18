import { BadRequestException } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Metric } from '../metric/entities/metric.entity';
import { metricExpression } from './metric-expression';
import { pinMetricFormula } from './metric-formula';
import type { CandidateMetricKey } from './bi-segment-engine';
import type { BiService } from './bi.service';
export type BiProfile = Awaited<ReturnType<BiService['profile']>>;
export type FrozenMetricReference = {
  id: number;
  version: number;
  definition: Record<string, any>;
};
export type CanonicalReuseNode = {
  id: number;
  definition: any;
  origin?: { id: number; version: number; digest: string };
};
export type ReuseMetricNode = {
  key: CandidateMetricKey;
  origin: { id: number; version: number; digest: string };
  definition: Record<string, any>;
  dependencies: CandidateMetricKey[];
};
export type ReuseMetricGraph = { nodes: ReuseMetricNode[]; digest: string };
export type PersistedReuseMetrics = Map<
  CandidateMetricKey,
  { id: number; definitionVersion: number; definition: Record<string, any> }
>;
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
const digest = (v: any) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fail = () =>
  new BadRequestException(
    '저장 지표 연결을 안전하게 복제할 수 없습니다. 원본 계산과 열 연결을 확인해 주세요. 기존 지표는 변경하지 않았습니다.',
  );
/** Shared graph builder. IDs below are local ordinals, never database IDs. */
export function createReuseMetricGraphBuilder(
  profile: any,
  target: any,
  mapping: Record<string, string>,
) {
  const nodes: CanonicalReuseNode[] = [];
  const known = new Map<string, CanonicalReuseNode>();
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
  const add = (id: number, version: number, definition: any): CanonicalReuseNode => {
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !definition ||
      definition.schemaVersion !== 1 ||
      definition.sourceId !== profile.sourceId ||
      definition.tableName !== 'uploaded_data' ||
      definition.definitionVersion !== version
    )
      throw fail();
    if (definition.businessBasis !== undefined) throw fail();
    const key = digest([id, version, definition]);
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
    if (typeof next.defaultDateColumn === 'string')
      next.defaultDateColumn = column(next.defaultDateColumn);
    metricExpression(next, target);
    const node = {
      id: nodes.length + 1,
      definition: next,
      origin: { id, version, digest: digest(definition) },
    };
    nodes.push(node);
    known.set(key, node);
    return node;
  };
  return { nodes, add };
}
export function buildReuseMetricGraph(input: {
  references: FrozenMetricReference[];
  originalProfile: BiProfile;
  targetProfile: BiProfile;
  columnMap: Record<string, string>;
}): ReuseMetricGraph {
  const builder = createReuseMetricGraphBuilder(
    input.originalProfile,
    input.targetProfile,
    input.columnMap,
  );
  for (const r of input.references) builder.add(r.id, r.version, r.definition);
  const key = (id: number): CandidateMetricKey => `candidate:${id}`;
  const nodes = builder.nodes.map(n => ({
    key: key(n.id),
    origin: n.origin,
    definition: n.definition,
    dependencies:
      n.definition.aggregation === 'FORMULA'
        ? n.definition.formula.operands.map(o => key(o.id))
        : [],
  }));
  return { nodes, digest: digest(nodes) };
}
/** The caller owns transaction and current actor/source/definition fences. */
export async function persistCanonicalNodes(
  nodes: CanonicalReuseNode[],
  sourceId: number,
  manager: EntityManager,
) {
  const saved = new Map<number, { id: number; definition: any }>();
  for (const node of nodes) {
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
  return saved;
}
export async function persistReuseMetricGraph(
  graph: ReuseMetricGraph,
  sourceId: number,
  dataVersion: string,
  manager: EntityManager,
): Promise<PersistedReuseMetrics> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Metric reuse requires an active transaction.');
  if (graph.digest !== digest(graph.nodes)) throw fail();
  const nodes = graph.nodes.map((n, i) => {
    if (n.key !== `candidate:${i + 1}` || n.definition.sourceId !== sourceId) throw fail();
    return { id: i + 1, definition: n.definition };
  });
  const saved = await persistCanonicalNodes(nodes, sourceId, manager);
  return new Map(
    [...saved].map(([id, row]) => [
      `candidate:${id}` as CandidateMetricKey,
      { ...row, definitionVersion: 1 },
    ]),
  );
}
