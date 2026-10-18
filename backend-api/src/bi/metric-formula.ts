import { BadRequestException } from '@nestjs/common';

/**
 * RXS-03 계산 지표(formula) 헬퍼. 이 파일은 저장 지표 정의를 **조립**만 하고, 지표 정의를 DB에서
 * 읽거나 권한을 확인하는 일은 하지 않는다(부모가 담당). 따라서 모든 export는 동기 함수이며
 * 클라이언트 AST와 서버가 이미 조회한 definition/profile만 입력으로 받는다.
 *
 * 클라이언트 AST (문자열·상수·SQL은 표현할 수 없다):
 *   { metricId: number, definitionVersion: number }                        // 잎 = 저장 지표 참조
 *   { op: 'add' | 'subtract', left: node, right: node }                    // 같은 단위끼리만
 *   { op: 'ratio', left: node, right: node, scale: 1 | 100 }               // 같은 단위끼리만
 *
 * 제한: 깊이 <= 4 (잎이 1), 노드 <= 31, 서로 다른 참조 지표 <= 6, 한 지표를 두 버전으로 참조 금지.
 * 노드 상한은 2차 방어선이다: 깊이 4인 이진 트리는 최대 15노드이므로 깊이 규칙이 먼저 막는다.
 * 잎은 schemaVersion 1, sourceId == profile.sourceId, tableName 'uploaded_data', definitionVersion
 * 정확히 일치, 그리고 FORMULA가 아닌 집계만 허용한다(FORMULA 잎은 순환을 만들 수 있어 후속 슬라이스).
 * 다른 소스의 지표를 이 소스로 옮겨오는 remap은 지원하지 않는다 → fail closed.
 *
 * 단위: USD/$/US$ → 'USD', KRW/₩/원 → 'KRW', count/건 → 'count', 빈 값/미지정은 ''(무단위)이며
 * count와 ''는 차원이 달라 서로 섞을 수 없다. 그 밖의 임의 단위는 trim 후 정확히 같을 때만 섞는다.
 * add/subtract는 정규화 단위가 같아야 하고 결과 단위도 그 토큰이며, ratio도 두 단위가 같아야 하고
 * scale 1은 '', scale 100은 '%'를 만든다. 결과 unit(화면 표시용 정규화 토큰)과 달리
 * operands[].definition.unit은 저장된 원문 그대로 보존한다(스냅샷 출처 보존).
 *
 * SQL은 항상 괄호로 정규화된 산술식이고, 분모는 NULLIF(x, 0)로 0 나눗셈을 막는다. 집계는 전부 잎
 * SQL(부모가 넘긴 compileLeaf) 안에서만 일어나며 이 헬퍼는 JS로 값을 합치지 않는다.
 */

export type FormulaMetricReference = { metricId: number; definitionVersion: number };

export type FormulaNode =
  | FormulaMetricReference
  | { op: 'add' | 'subtract'; left: FormulaNode; right: FormulaNode }
  | { op: 'ratio'; left: FormulaNode; right: FormulaNode; scale: 1 | 100 };

/**
 * 잎 definition의 허용 키만 복제한 객체. 허용 목록 밖의 키(예: sql, expression, formula,
 * __proto__, constructor, prototype)는 거부한다.
 */
export type FormulaLeafDefinition = {
  schemaVersion: 1;
  definitionVersion: number;
  sourceId: number;
  tableName: 'uploaded_data';
  label: string;
  unit: string;
  decimalPlaces: number;
  numberNotation: 'plain' | 'compact';
  aggregation: string;
  column?: string;
  denominatorColumn?: string;
  weightColumn?: string;
  scale?: 1 | 100;
};

/** pin 결과의 피연산자. definition은 위 허용 키만 가진 복제본이다. */
export type FormulaOperand = {
  id: number;
  definitionVersion: number;
  definition: FormulaLeafDefinition;
};

/**
 * 저장 가능한 고정 스냅샷. expression은 검증된 AST 복제본, operands는 (id, version) 오름차순,
 * unit은 추론된 결과 단위다. 재사용 시 compileMetricFormula가 형태/소스/버전/컬럼을 다시 검증한다.
 */
export type FrozenMetricFormula = {
  expression: FormulaNode;
  operands: FormulaOperand[];
  unit: string;
};

/** 부모가 넘기는 안전한 비-FORMULA 잎 SQL 컴파일러(예: metricExpression). */
export type FormulaLeafCompiler = (
  definition: FormulaLeafDefinition,
  profile: FormulaProfileLike,
) => string;

/** profile에서 이 헬퍼가 실제로 읽는 부분만 좁혀 쓴 형태. */
export type FormulaProfileLike = {
  sourceId: number;
  columns: Array<{ name: string; type?: string; numeric?: boolean }>;
};

export const FORMULA_LIMITS = {
  maxDepth: 4,
  maxNodes: 31,
  maxReferences: 6,
  maxUnitLength: 12,
  maxLabelLength: 100,
  maxColumnLength: 128,
  maxLeafSqlLength: 10000,
} as const;

/** 잎 definition에서 복제를 허용하는 키. */
const LEAF_DEFINITION_KEYS = [
  'schemaVersion',
  'definitionVersion',
  'sourceId',
  'tableName',
  'label',
  'unit',
  'decimalPlaces',
  'numberNotation',
  'aggregation',
  'column',
  'denominatorColumn',
  'weightColumn',
  'scale',
];

/** FORMULA는 순환 위험 때문에 이 슬라이스에서 잎이 될 수 없다. */
const LEAF_AGGREGATIONS = [
  'SUM',
  'AVG',
  'COUNT',
  'MIN',
  'MAX',
  'COUNT_DISTINCT',
  'RATIO_SUM',
  'WEIGHTED_AVG',
];

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
const FROZEN_KEYS = ['expression', 'operands', 'unit'];
const OPERAND_KEYS = ['id', 'definitionVersion', 'definition'];

const referenceKey = (id: number, definitionVersion: number) => id + ':' + definitionVersion;

function object(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException(what + ' must be an object');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  for (const forbidden of FORBIDDEN_KEYS) {
    if (keys.includes(forbidden)) throw new BadRequestException(what + ' has a forbidden key');
  }
  return input;
}

function allowedKeys(input: Record<string, unknown>, allowed: string[], what: string) {
  const unknown = Object.keys(input).find(key => !allowed.includes(key));
  if (unknown) throw new BadRequestException(what + ' has an unsupported field: ' + unknown);
}

function positiveInteger(value: unknown, what: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new BadRequestException(what + ' must be a positive integer');
  return Number(value);
}

function scanFormula(node: unknown) {
  const references = new Map<string, FormulaMetricReference>();
  let nodes = 0;
  const build = (value: unknown, depth: number): FormulaNode => {
    if (depth > FORMULA_LIMITS.maxDepth)
      throw new BadRequestException('formula depth exceeds ' + FORMULA_LIMITS.maxDepth + ' levels');
    const input = object(value, 'formula node');
    const keys = Object.keys(input);
    if (keys.includes('metricId') || keys.includes('definitionVersion')) {
      allowedKeys(input, ['metricId', 'definitionVersion'], 'formula reference');
      const metricId = positiveInteger(input.metricId, 'metricId');
      const definitionVersion = positiveInteger(input.definitionVersion, 'definitionVersion');
      nodes += 1;
      if (nodes > FORMULA_LIMITS.maxNodes)
        throw new BadRequestException('formula has too many nodes');
      const existing = references.get(String(metricId));
      // One metric at two versions would make the operand set ambiguous.
      if (existing && existing.definitionVersion !== definitionVersion)
        throw new BadRequestException('formula references one metric at two versions');
      references.set(String(metricId), { metricId, definitionVersion });
      if (references.size > FORMULA_LIMITS.maxReferences)
        throw new BadRequestException(
          'formula references more than ' + FORMULA_LIMITS.maxReferences + ' metrics',
        );
      return { metricId, definitionVersion };
    }
    if (keys.includes('op')) {
      const op = input.op;
      if (op !== 'add' && op !== 'subtract' && op !== 'ratio')
        throw new BadRequestException('unsupported formula operator');
      allowedKeys(
        input,
        op === 'ratio' ? ['op', 'left', 'right', 'scale'] : ['op', 'left', 'right'],
        'formula operator',
      );
      nodes += 1;
      if (nodes > FORMULA_LIMITS.maxNodes)
        throw new BadRequestException('formula has too many nodes');
      const left = build(input.left, depth + 1);
      const right = build(input.right, depth + 1);
      if (op === 'ratio') {
        if (input.scale !== 1 && input.scale !== 100)
          throw new BadRequestException('ratio scale must be 1 or 100');
        return { op, left, right, scale: input.scale };
      }
      return { op, left, right };
    }
    // Anything else — a constant, a text token or raw SQL — is not a formula node.
    throw new BadRequestException('formula node needs metricId or op');
  };
  const expression = build(node, 1);
  return { expression, references: [...references.values()], nodes };
}

/** 클라이언트 AST를 검증하고 참조 지표를 metricId 오름차순으로 돌려준다. */
export function collectFormulaReferences(node: unknown): FormulaMetricReference[] {
  return scanFormula(node)
    .references.slice()
    .sort((a, b) => a.metricId - b.metricId);
}

/** USD/$/US$, KRW/₩/원, count/건을 하나로 묶고 나머지는 trim한 그대로 비교한다. */
export function normalizeFormulaUnit(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new BadRequestException('invalid metric unit');
  const trimmed = value.trim();
  if (trimmed.length > FORMULA_LIMITS.maxUnitLength)
    throw new BadRequestException('invalid metric unit');
  const lower = trimmed.toLowerCase();
  if (lower === 'usd' || trimmed === '$' || lower === 'us$') return 'USD';
  if (lower === 'krw' || trimmed === '₩' || trimmed === '원') return 'KRW';
  // A count is its own dimension: it must not mix with an untagged (dimensionless) metric.
  if (lower === 'count' || trimmed === '건') return 'count';
  return trimmed;
}

function leafDefinition(
  value: unknown,
  reference: FormulaMetricReference,
  profile: FormulaProfileLike,
): FormulaLeafDefinition {
  const input = object(value, 'operand definition');
  allowedKeys(input, LEAF_DEFINITION_KEYS, 'operand definition');
  if (input.schemaVersion !== 1) throw new BadRequestException('operand schemaVersion must be 1');
  const definitionVersion = positiveInteger(input.definitionVersion, 'operand definitionVersion');
  if (definitionVersion !== reference.definitionVersion)
    throw new BadRequestException('operand definitionVersion does not match the formula reference');
  if (positiveInteger(input.sourceId, 'operand sourceId') !== profile.sourceId)
    throw new BadRequestException('operand belongs to another source');
  if (input.tableName !== 'uploaded_data')
    throw new BadRequestException('operand tableName must be uploaded_data');
  const aggregation = input.aggregation;
  if (typeof aggregation !== 'string' || !LEAF_AGGREGATIONS.includes(aggregation))
    throw new BadRequestException('operand aggregation is not supported in a formula');
  const label = input.label === undefined ? '' : input.label;
  if (typeof label !== 'string' || label.length > FORMULA_LIMITS.maxLabelLength)
    throw new BadRequestException('invalid operand label');
  // Kept verbatim so the frozen snapshot stays a faithful record of the stored definition;
  // comparison and the resulting display unit use normalizeFormulaUnit instead.
  const unit = input.unit === undefined ? '' : input.unit;
  if (
    ['COUNT', 'COUNT_DISTINCT'].includes(aggregation) &&
    !['', 'count'].includes(normalizeFormulaUnit(unit))
  )
    throw new BadRequestException('count operands cannot declare money or percentage units');
  if (typeof unit !== 'string' || unit.length > FORMULA_LIMITS.maxUnitLength)
    throw new BadRequestException('invalid metric unit');
  const decimalPlaces = input.decimalPlaces === undefined ? 0 : input.decimalPlaces;
  if (!Number.isInteger(decimalPlaces) || Number(decimalPlaces) < 0 || Number(decimalPlaces) > 6)
    throw new BadRequestException('invalid operand decimalPlaces');
  const numberNotation = input.numberNotation === undefined ? 'plain' : input.numberNotation;
  if (numberNotation !== 'plain' && numberNotation !== 'compact')
    throw new BadRequestException('invalid operand numberNotation');
  const columns = profile.columns || [];
  const named = (name: unknown, what: string) => {
    if (typeof name !== 'string' || !name.trim() || name.length > FORMULA_LIMITS.maxColumnLength)
      throw new BadRequestException('invalid operand ' + what + ' column');
    const found = columns.find(column => column.name === name);
    if (!found) throw new BadRequestException('operand ' + what + ' column is not in the source');
    return found;
  };
  const definition: FormulaLeafDefinition = {
    schemaVersion: 1,
    definitionVersion,
    sourceId: profile.sourceId,
    tableName: 'uploaded_data',
    label,
    unit,
    decimalPlaces: Number(decimalPlaces),
    numberNotation,
    aggregation,
  };
  if (aggregation === 'COUNT') {
    if (input.column !== undefined && input.column !== '*')
      throw new BadRequestException('COUNT operand takes no column');
    if (input.scale !== undefined) throw new BadRequestException('unsupported operand scale');
    return definition;
  }
  const primary = named(input.column, '');
  if (aggregation !== 'COUNT_DISTINCT' && !primary.numeric)
    throw new BadRequestException('operand column must be numeric');
  definition.column = primary.name;
  if (aggregation === 'RATIO_SUM' || aggregation === 'WEIGHTED_AVG') {
    const key = aggregation === 'RATIO_SUM' ? 'denominatorColumn' : 'weightColumn';
    const secondary = named(input[key], key);
    if (!secondary.numeric) throw new BadRequestException('operand ' + key + ' must be numeric');
    if (aggregation === 'RATIO_SUM') {
      if (input.scale !== 1 && input.scale !== 100)
        throw new BadRequestException('operand RATIO_SUM scale must be 1 or 100');
      definition.scale = input.scale;
    } else definition.weightColumn = secondary.name;
    if (aggregation === 'RATIO_SUM') definition.denominatorColumn = secondary.name;
  } else if (input.scale !== undefined) {
    throw new BadRequestException('unsupported operand scale');
  }
  return definition;
}

/** 두 단위가 같아야 한다. add/subtract는 그 단위를, ratio는 scale 1이면 '', 100이면 '%'를 만든다. */
function unitOf(node: FormulaNode, units: Map<string, string>): string {
  if ('metricId' in node)
    return units.get(referenceKey(node.metricId, node.definitionVersion)) ?? '';
  const left = unitOf(node.left, units);
  const right = unitOf(node.right, units);
  if (left !== right)
    throw new BadRequestException(
      'formula operands must share one unit: ' + (left || '(none)') + ' vs ' + (right || '(none)'),
    );
  if (node.op === 'ratio') return node.scale === 100 ? '%' : '';
  return left;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

/**
 * 클라이언트 AST와 서버가 이미 조회한 정의 목록을 고정 스냅샷으로 만든다.
 * definitions는 AST가 참조한 (id, version) 집합과 정확히 일치해야 한다 — 누락/미사용/중복은 거부한다.
 * 여기서는 SQL을 만들지 않는다(잎 SQL 검증·생성은 compileMetricFormula의 callback 책임).
 */
export function pinMetricFormula(
  node: unknown,
  definitions: unknown,
  profile: FormulaProfileLike,
): FrozenMetricFormula {
  const scan = scanFormula(node);
  if (!Array.isArray(definitions))
    throw new BadRequestException('formula definitions must be an array');
  const wanted = new Map(
    scan.references.map(reference => [
      referenceKey(reference.metricId, reference.definitionVersion),
      reference,
    ]),
  );
  const operands = new Map<string, FormulaOperand>();
  for (const entry of definitions) {
    const input = object(entry, 'formula operand');
    allowedKeys(input, OPERAND_KEYS, 'formula operand');
    const id = positiveInteger(input.id, 'operand id');
    const definitionVersion = positiveInteger(input.definitionVersion, 'operand definitionVersion');
    const lookup = referenceKey(id, definitionVersion);
    if (!wanted.has(lookup))
      throw new BadRequestException('formula operand is not referenced by the expression');
    if (operands.has(lookup)) throw new BadRequestException('duplicate formula operand');
    operands.set(lookup, {
      id,
      definitionVersion,
      definition: leafDefinition(input.definition, wanted.get(lookup), profile),
    });
  }
  for (const [lookup, reference] of wanted) {
    if (!operands.has(lookup))
      throw new BadRequestException(
        'missing formula operand ' + reference.metricId + '@' + reference.definitionVersion,
      );
  }
  // Comparison units are normalized; the operand snapshots keep their original strings above.
  const units = new Map(
    [...operands].map(([lookup, operand]) => [
      lookup,
      ['COUNT', 'COUNT_DISTINCT'].includes(operand.definition.aggregation)
        ? 'count'
        : normalizeFormulaUnit(operand.definition.unit),
    ]),
  );
  const unit = unitOf(scan.expression, units);
  return deepFreeze({
    expression: scan.expression,
    operands: [...operands.values()].sort(
      (a, b) => a.id - b.id || a.definitionVersion - b.definitionVersion,
    ),
    unit,
  });
}

function operandColumns(definition: FormulaLeafDefinition) {
  return [definition.column, definition.denominatorColumn, definition.weightColumn].filter(
    (name): name is string => typeof name === 'string' && !!name && name !== '*',
  );
}

/**
 * 고정 스냅샷을 SQL 산술식으로 컴파일한다. 매 호출마다 AST 형태, 소스/버전/테이블, 잎 집계,
 * 현재 profile의 컬럼·타입, 저장된 unit을 다시 검증한다(fail closed). 잎 SQL은 callback이 만들고,
 * 이 함수는 그 결과가 비어 있지 않고 ';'/주석 토큰이 없는 문자열인지만 추가로 확인한다.
 */
export function compileMetricFormula(
  frozen: unknown,
  profile: FormulaProfileLike,
  compileLeaf: FormulaLeafCompiler,
) {
  if (typeof compileLeaf !== 'function')
    throw new BadRequestException('formula leaf compiler is required');
  const input = object(frozen, 'frozen formula');
  allowedKeys(input, FROZEN_KEYS, 'frozen formula');
  if (!Array.isArray(input.operands))
    throw new BadRequestException('frozen formula operands must be an array');
  // pinMetricFormula revalidates the AST, every operand against the current profile, and the unit.
  const pinned = pinMetricFormula(input.expression, input.operands, profile);
  if (input.unit !== pinned.unit)
    throw new BadRequestException('frozen formula unit does not match its operands');
  const leaves = new Map<string, string>();
  const columns: string[] = [];
  const sql = (node: FormulaNode): string => {
    if (!('metricId' in node)) {
      const left = sql(node.left);
      const right = sql(node.right);
      if (node.op === 'ratio')
        return (
          '(' + left + ' / NULLIF(' + right + ', 0)' + (node.scale === 100 ? ' * 100' : '') + ')'
        );
      return '(' + left + ' ' + (node.op === 'add' ? '+' : '-') + ' ' + right + ')';
    }
    const lookup = referenceKey(node.metricId, node.definitionVersion);
    const cached = leaves.get(lookup);
    if (cached !== undefined) return cached;
    const operand = pinned.operands.find(
      candidate =>
        candidate.id === node.metricId && candidate.definitionVersion === node.definitionVersion,
    );
    if (!operand) throw new BadRequestException('formula operand is missing');
    const leaf = compileLeaf(operand.definition, profile);
    if (
      typeof leaf !== 'string' ||
      !leaf.trim() ||
      leaf.length > FORMULA_LIMITS.maxLeafSqlLength ||
      /;|--|\/\*/.test(leaf)
    )
      throw new BadRequestException('formula leaf SQL is not allowed');
    const value = '(' + leaf.trim() + ')';
    leaves.set(lookup, value);
    for (const column of operandColumns(operand.definition))
      if (!columns.includes(column)) columns.push(column);
    return value;
  };
  return { sql: sql(pinned.expression), unit: pinned.unit, columns };
}
