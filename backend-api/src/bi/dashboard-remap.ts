/**
 * UC-020: bounded, pure remap of a saved dashboard draft onto a different DuckDB source.
 *
 * Stored SQL is already restricted by validateSourceSql to one `SELECT ... FROM source`
 * against the reserved relation, so this module only has to understand that small grammar.
 * It renames exactly the source columns a widget uses, keeps every literal, cast type and
 * output alias untouched, and refuses any statement it cannot resolve unambiguously instead
 * of emitting SQL that silently reads another column. Nothing here touches a database,
 * storage or HTTP.
 */
import { BadRequestException } from '@nestjs/common';
import {
  ConditionDefinition,
  ConditionNode,
  compileConditionDefinition,
  conditionColumns,
} from './source-condition-definition';
import {
  validateStudioConditions,
  validateStudioDateRange,
  validateStudioFilters,
} from '../dashboard-studio/studio-document';
import { StudioDateRange, StudioFilter } from '../dashboard-studio/studio-contract';
import { DashboardDraft, positiveId, quoteColumn, validateSourceSql } from '../ai/dashboard-draft';

/** One source column reused by the draft; the shape BiService.profile already returns. */
export interface ReuseColumn {
  name: string;
  type: string;
  numeric: boolean;
  temporal: boolean;
}
export interface ReuseSourceProfile {
  sourceId: number;
  columns: Array<{ name: string; type: string; numeric?: boolean; temporal?: boolean }>;
}
type TokenKind = 'space' | 'string' | 'quoted' | 'word' | 'number' | 'punct';
interface Token {
  text: string;
  kind: TokenKind;
}
interface ColumnRef {
  index: number;
  name: string;
  original: string;
}
interface PlainItem {
  endIndex: number;
  name: string;
  original: string;
}
interface SqlPlan {
  tokens: Token[];
  refs: ColumnRef[];
  plain: PlainItem[];
}

/** Same token surface as validateSourceSql, so both agree on what a draft may contain. */
const TOKEN_RE =
  /'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|\s+|[(),.*+\-\/%=<>!:]/g;
const CLAUSE_KEYWORDS = new Set('select from where group having order limit offset'.split(' '));
const WORD_KEYWORDS = new Set(
  (
    'all as asc and between by case collate desc distinct else end escape false filter first from ' +
    'group having ilike in interval is last like limit not null nulls offset or order select then ' +
    'true when where'
  ).split(' '),
);
const CAST_FUNCTIONS = new Set(['cast', 'try_cast']);
const NUMERIC_TYPE =
  /^(?:U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)/i;
const TEMPORAL_TYPE = /^(?:DATE|TIMESTAMP)/i;
// Anchored so VARCHAR[] or CHARACTER VARYING are not read as the text family; only an
// optional length is allowed after the type name.
const STRING_TYPE = /^(?:VARCHAR|CHAR|BPCHAR|NVARCHAR|TEXT|STRING)(?:\s*\(\s*\d+\s*\))?$/i;
const isIdentifier = (token: Token) => token.kind === 'word' || token.kind === 'quoted';
const identifierOf = (token: Token) =>
  token.kind === 'quoted' ? token.text.slice(1, -1).replace(/""/g, '"') : token.text;
const exactType = (type: string) => type.trim().toLowerCase().replace(/\s+/g, '');

function tokenKind(text: string): TokenKind {
  if (/^\s+$/.test(text)) return 'space';
  if (text.startsWith("'")) return 'string';
  if (text.startsWith('"')) return 'quoted';
  if (/^[A-Za-z_]/.test(text)) return 'word';
  return /^\d/.test(text) ? 'number' : 'punct';
}

function tokenize(sql: string): Token[] {
  const raw = sql.match(TOKEN_RE) || [];
  if (raw.join('') !== sql) throw new BadRequestException('invalid SQL tokens');
  return raw.map(text => ({ text, kind: tokenKind(text) }));
}

/** Profile columns by lower-case name; the same name twice cannot be resolved. */
function collectColumns(profile: ReuseSourceProfile): Map<string, ReuseColumn> {
  if (!profile || !Array.isArray(profile.columns))
    throw new BadRequestException('invalid source profile');
  const columns = new Map<string, ReuseColumn>();
  for (const column of profile.columns) {
    if (
      !column ||
      typeof column.name !== 'string' ||
      !column.name.trim() ||
      typeof column.type !== 'string'
    )
      throw new BadRequestException('invalid source profile column');
    const name = column.name.trim();
    if (columns.has(name.toLowerCase()))
      throw new BadRequestException('ambiguous source profile column');
    columns.set(name.toLowerCase(), {
      name,
      type: column.type,
      numeric:
        typeof column.numeric === 'boolean' ? column.numeric : NUMERIC_TYPE.test(column.type),
      temporal:
        typeof column.temporal === 'boolean' ? column.temporal : TEMPORAL_TYPE.test(column.type),
    });
  }
  return columns;
}

/**
 * Bounded walk of one already-validated statement: which source columns it reads, and which
 * bare SELECT items must keep their output name after a rename.
 */
function planSql(sql: string, columns: Map<string, ReuseColumn>): SqlPlan {
  const tokens = tokenize(validateSourceSql(sql));
  const indexes: number[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'space') indexes.push(index);
  });
  const size = indexes.length;
  const tokenAt = (k: number) => tokens[indexes[k]];
  const depthAt: number[] = new Array(size).fill(0);
  let syntaxDepth = 0;
  for (let k = 0; k < size; k++) {
    depthAt[k] = syntaxDepth;
    const punctuator = tokenAt(k).text;
    if (tokenAt(k).kind === 'punct' && punctuator === '(') syntaxDepth += 1;
    else if (tokenAt(k).kind === 'punct' && punctuator === ')') syntaxDepth -= 1;
  }
  if (syntaxDepth !== 0 || size < 4) throw new BadRequestException('unsupported SQL shape');

  const clauseStarts = new Map<string, number>();
  for (let k = 0; k < size; k++) {
    const token = tokenAt(k);
    if (token.kind !== 'word' || depthAt[k] !== 0) continue;
    const lower = token.text.toLowerCase();
    if (CLAUSE_KEYWORDS.has(lower) && !clauseStarts.has(lower)) clauseStarts.set(lower, k);
  }
  const selectAt = clauseStarts.get('select');
  const fromAt = clauseStarts.get('from');
  if (selectAt !== 0 || fromAt === undefined || fromAt < 2)
    throw new BadRequestException('unsupported SQL shape');
  const clauseOf: string[] = new Array(size).fill('select');
  [...clauseStarts.entries()]
    .sort((left, right) => left[1] - right[1])
    .forEach(([name, start], position, ordered) => {
      const end = position + 1 < ordered.length ? ordered[position + 1][1] : size;
      for (let k = start; k < end; k++) clauseOf[k] = name;
    });

  const refs: ColumnRef[] = [];
  const aliasNames = new Set<string>();
  const aliasIndexes = new Set<number>();
  const plain: PlainItem[] = [];
  let itemStart = selectAt + 1;
  for (let k = itemStart; k <= fromAt; k++) {
    const boundary =
      k === fromAt || (tokenAt(k).kind === 'punct' && tokenAt(k).text === ',' && depthAt[k] === 0);
    if (!boundary) continue;
    if (k === itemStart) throw new BadRequestException('unsupported SQL shape');
    const start = itemStart;
    itemStart = k + 1;
    let asAt = -1;
    for (let i = start; i < k; i++)
      if (depthAt[i] === 0 && tokenAt(i).kind === 'word' && tokenAt(i).text.toLowerCase() === 'as')
        asAt = i;
    let expressionEnd = k;
    let alias = -1;
    if (asAt >= 0 && asAt + 1 < k && isIdentifier(tokenAt(asAt + 1))) {
      expressionEnd = asAt;
      alias = asAt + 1;
    } else if (
      k - 1 > start &&
      isIdentifier(tokenAt(k - 1)) &&
      (isIdentifier(tokenAt(k - 2)) ||
        (tokenAt(k - 2).kind === 'punct' && tokenAt(k - 2).text === ')'))
    ) {
      expressionEnd = k - 1;
      alias = k - 1;
    }
    if (alias >= 0) {
      aliasIndexes.add(indexes[alias]);
      aliasNames.add(identifierOf(tokenAt(alias)).toLowerCase());
      continue;
    }
    const length = expressionEnd - start;
    let columnAt = -1;
    if (length === 1 && isIdentifier(tokenAt(start))) columnAt = start;
    else if (
      length === 3 &&
      isIdentifier(tokenAt(start)) &&
      tokenAt(start + 1).text === '.' &&
      isIdentifier(tokenAt(start + 2))
    ) {
      if (identifierOf(tokenAt(start)).toLowerCase() !== 'source')
        throw new BadRequestException('only source relation is allowed');
      columnAt = start + 2;
    }
    if (columnAt < 0) continue;
    const original = identifierOf(tokenAt(columnAt));
    const column = columns.get(original.toLowerCase());
    if (!column) throw new BadRequestException(`unsupported SQL identifier: ${original}`);
    plain.push({ endIndex: indexes[k - 1], name: column.name, original });
  }

  const calls: Array<{ fn: string; depth: number }> = [];
  const isCastType = () => {
    const frame = calls.length ? calls[calls.length - 1] : undefined;
    return !!frame && CAST_FUNCTIONS.has(frame.fn) && frame.depth === walkDepth;
  };
  const pushColumn = (index: number, original: string) => {
    const column = columns.get(original.toLowerCase());
    if (!column) throw new BadRequestException(`unsupported SQL identifier: ${original}`);
    refs.push({ index: indexes[index], name: column.name, original });
  };
  let walkDepth = 0;
  let pendingFn = '';
  let castTypeDepth = -1;
  for (let k = 0; k < size; k++) {
    const token = tokenAt(k);
    const punct = token.kind === 'punct' ? token.text : '';
    if (punct === '(') {
      walkDepth += 1;
      calls.push({ fn: pendingFn, depth: walkDepth });
      pendingFn = '';
      continue;
    }
    if (punct === ')') {
      if (calls.length && calls[calls.length - 1].depth === walkDepth) calls.pop();
      walkDepth -= 1;
      if (castTypeDepth > walkDepth) castTypeDepth = -1;
      continue;
    }
    if (!isIdentifier(token)) {
      pendingFn = '';
      continue;
    }
    const original = identifierOf(token);
    const lower = original.toLowerCase();
    const before = k > 0 ? tokenAt(k - 1) : undefined;
    const after = k + 1 < size ? tokenAt(k + 1) : undefined;
    const nextIsCall = after?.kind === 'punct' && after.text === '(';
    const previousIsDot = before?.kind === 'punct' && before.text === '.';
    const nextIsDot = after?.kind === 'punct' && after.text === '.';
    if (nextIsCall) {
      pendingFn = lower;
      continue;
    }
    // Cast spellings ("AS TYPE" and "::TYPE") are types, never source columns.
    if (castTypeDepth === walkDepth || (before?.kind === 'punct' && before.text === ':')) continue;
    if (lower === 'as' && isCastType()) {
      castTypeDepth = walkDepth;
      continue;
    }
    if (clauseOf[k] === 'from') continue;
    if (previousIsDot || nextIsDot) {
      const qualifier =
        previousIsDot && k - 2 >= 0 && isIdentifier(tokenAt(k - 2)) ? tokenAt(k - 2) : undefined;
      if (
        nextIsDot
          ? lower !== 'source'
          : !qualifier || identifierOf(qualifier).toLowerCase() !== 'source'
      )
        throw new BadRequestException('only source relation is allowed');
      if (previousIsDot) pushColumn(k, original);
      continue;
    }
    if (aliasIndexes.has(indexes[k])) continue;
    if (aliasNames.has(lower)) {
      // A name that is both an output alias and a source column cannot be resolved without
      // guessing which one the statement meant.
      if (columns.has(lower)) throw new BadRequestException('ambiguous column reference');
      continue;
    }
    if (columns.has(lower)) {
      pushColumn(k, original);
      continue;
    }
    if (WORD_KEYWORDS.has(lower)) continue;
    throw new BadRequestException(`unsupported SQL identifier: ${original}`);
  }
  return { tokens, refs, plain };
}

function rewriteSql(plan: SqlPlan, mapping: Map<string, string>): string {
  const tokens = [...plan.tokens];
  for (const ref of plan.refs) {
    const target = mapping.get(ref.name.toLowerCase());
    if (target === undefined) throw new BadRequestException(`missing column mapping: ${ref.name}`);
    if (target.toLowerCase() === ref.original.toLowerCase()) continue;
    tokens[ref.index] = { ...tokens[ref.index], text: quoteColumn(target) };
  }
  const insertions: Array<{ at: number; text: string }> = [];
  for (const item of plan.plain) {
    const target = mapping.get(item.name.toLowerCase());
    if (target === undefined) throw new BadRequestException(`missing column mapping: ${item.name}`);
    // Keep the original output name so valueField/categoryField stay valid.
    if (target.toLowerCase() !== item.original.toLowerCase())
      insertions.push({ at: item.endIndex + 1, text: ` AS ${quoteColumn(item.name)}` });
  }
  insertions.sort((left, right) => right.at - left.at);
  for (const insertion of insertions)
    tokens.splice(insertion.at, 0, { kind: 'space', text: insertion.text });
  return tokens.map(token => token.text).join('');
}

function reusedColumns(plans: SqlPlan[], columns: Map<string, ReuseColumn>): ReuseColumn[] {
  const used = new Map<string, ReuseColumn>();
  for (const plan of plans)
    for (const ref of plan.refs) {
      const key = ref.name.toLowerCase();
      if (!used.has(key)) used.set(key, columns.get(key) as ReuseColumn);
    }
  return [...used.values()];
}

/** Frozen scope is independent of source identity in a private reuse recipe. */
export type ReuseScope = {
  conditionDefinition?: ConditionDefinition;
  defaultFilters?: StudioFilter[];
  defaultDateRange?: StudioDateRange;
};
export function reuseScope(draft: any, profile: ReuseSourceProfile): ReuseScope {
  const scope: ReuseScope = {};
  if (draft.defaultConditions !== undefined && draft.conditionDefinition !== undefined)
    throw new BadRequestException('ambiguous reuse conditions');
  const definition =
    draft.defaultConditions !== undefined
      ? validateStudioConditions(draft.defaultConditions).definition
      : draft.conditionDefinition;
  if (definition !== undefined)
    scope.conditionDefinition = compileConditionDefinition(
      definition,
      conditionColumns(profile.columns),
    ).definition;
  if (draft.defaultFilters !== undefined)
    scope.defaultFilters = validateStudioFilters(draft.defaultFilters);
  if (draft.defaultDateRange !== undefined)
    scope.defaultDateRange = validateStudioDateRange(draft.defaultDateRange);
  return scope;
}
function scopeColumns(scope: ReuseScope, columns: Map<string, ReuseColumn>): ReuseColumn[] {
  const used = new Map<string, ReuseColumn>();
  const add = (name: string) => {
    const column = columns.get(name.toLowerCase());
    if (!column) throw new BadRequestException('missing reuse scope column');
    used.set(column.name.toLowerCase(), column);
  };
  const visit = (node: ConditionNode | null) => {
    if (!node) return;
    if (node.kind === 'group') return node.children.forEach(visit);
    add(node.column);
  };
  if (scope.conditionDefinition) {
    visit(scope.conditionDefinition.include);
    visit(scope.conditionDefinition.exclude);
  }
  for (const filter of scope.defaultFilters ?? []) add(filter.column);
  if (scope.defaultDateRange) {
    add(scope.defaultDateRange.column);
    if (!columns.get(scope.defaultDateRange.column.toLowerCase()).temporal)
      throw new BadRequestException('invalid reuse date column');
  }
  return [...used.values()];
}
function allColumns(plans: SqlPlan[], columns: Map<string, ReuseColumn>, scope: ReuseScope) {
  return [
    ...new Map(
      [...reusedColumns(plans, columns), ...scopeColumns(scope, columns)].map(column => [
        column.name.toLowerCase(),
        column,
      ]),
    ).values(),
  ];
}

/** The source columns a draft actually reads, in first-use order. */
export function reuseColumns(
  draft: DashboardDraft,
  sourceProfile: ReuseSourceProfile,
): ReuseColumn[] {
  const columns = collectColumns(sourceProfile);
  if (!draft || !Array.isArray(draft.widgets) || !draft.widgets.length)
    throw new BadRequestException('invalid draft');
  return allColumns(
    draft.widgets.map(widget => planSql(widget.sql, columns)),
    columns,
    reuseScope(draft, sourceProfile),
  );
}

/** Type compatibility for a reused column; never a lossy conversion. */
export function compatibleReuseColumn(from: ReuseColumn, to: ReuseColumn): boolean {
  if (!from || !to || typeof from.type !== 'string' || typeof to.type !== 'string') return false;
  if (from.numeric || to.numeric) return from.numeric && to.numeric;
  if (from.temporal || to.temporal)
    // Exact type only: TIMESTAMP vs TIMESTAMPTZ or vs TIMESTAMP_NS would change the
    // timezone or precision semantics of the same numbers, so it is never implicit.
    return from.temporal && to.temporal && exactType(from.type) === exactType(to.type);
  const fromString = STRING_TYPE.test(from.type.trim());
  const toString = STRING_TYPE.test(to.type.trim());
  if (fromString || toString) return fromString && toString;
  return exactType(from.type) === exactType(to.type);
}

/**
 * Rewrite the draft onto the target source. columnMap must name exactly the reused columns;
 * the result keeps title, layout, block identity and display options and changes only the
 * source id, the SQL column identifiers and, where needed, output aliases.
 */
export function remapDashboard(
  draft: DashboardDraft,
  sourceProfile: ReuseSourceProfile,
  targetProfile: ReuseSourceProfile,
  columnMap: Record<string, string>,
): DashboardDraft & ReuseScope {
  const source = collectColumns(sourceProfile);
  const target = collectColumns(targetProfile);
  const databaseId = positiveId(targetProfile.sourceId);
  if (!draft || !Array.isArray(draft.widgets) || !draft.widgets.length)
    throw new BadRequestException('invalid draft');
  if (!columnMap || typeof columnMap !== 'object' || Array.isArray(columnMap))
    throw new BadRequestException('invalid column mapping');
  const plans = draft.widgets.map(widget => planSql(widget.sql, source));
  const scope = reuseScope(draft, sourceProfile);
  const required = allColumns(plans, source, scope);
  const mapping = new Map<string, string>();
  for (const [key, value] of Object.entries(columnMap)) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException('invalid column mapping');
    const from = required.find(column => column.name.toLowerCase() === key.trim().toLowerCase());
    if (!from) throw new BadRequestException(`unsupported column mapping: ${key}`);
    if (mapping.has(from.name.toLowerCase()))
      throw new BadRequestException(`duplicate column mapping: ${key}`);
    const to = target.get(value.trim().toLowerCase());
    if (!to) throw new BadRequestException(`unknown target column: ${value}`);
    if (!compatibleReuseColumn(from, to))
      throw new BadRequestException(`incompatible target column: ${value}`);
    mapping.set(from.name.toLowerCase(), to.name);
  }
  for (const column of required)
    if (!mapping.has(column.name.toLowerCase()))
      throw new BadRequestException(`missing column mapping: ${column.name}`);
  const scoped = scopeColumns(scope, source);
  const scopeTargets = new Set<string>();
  for (const column of scoped) {
    const targetName = mapping.get(column.name.toLowerCase());
    if (scopeTargets.has(targetName.toLowerCase()))
      throw new BadRequestException('duplicate reuse scope target');
    scopeTargets.add(targetName.toLowerCase());
  }
  const visit = (node: ConditionNode | null): ConditionNode | null => {
    if (!node) return null;
    if (node.kind === 'group') return { ...node, children: node.children.map(visit) };
    return { ...node, column: mapping.get(node.column.toLowerCase()) };
  };
  const mapped: ReuseScope = {
    ...(scope.conditionDefinition
      ? {
          conditionDefinition: compileConditionDefinition(
            {
              include: visit(scope.conditionDefinition.include),
              exclude: visit(scope.conditionDefinition.exclude),
            },
            conditionColumns(targetProfile.columns),
          ).definition,
        }
      : {}),
    ...(scope.defaultFilters
      ? {
          defaultFilters: scope.defaultFilters.map(filter => ({
            ...filter,
            column: mapping.get(filter.column.toLowerCase()),
            values: [...filter.values],
          })),
        }
      : {}),
    ...(scope.defaultDateRange
      ? {
          defaultDateRange: {
            ...scope.defaultDateRange,
            column: mapping.get(scope.defaultDateRange.column.toLowerCase()),
          },
        }
      : {}),
  };
  const result = {
    ...draft,
    ...mapped,
    databaseId,
    widgets: draft.widgets.map((widget, index) => ({
      ...widget,
      sql: validateSourceSql(rewriteSql(plans[index], mapping)),
    })),
  };
  // Never forward the owner's file identity to a recipient or let validateDraft erase scope.
  delete (result as any).defaultConditions;
  return result;
}
