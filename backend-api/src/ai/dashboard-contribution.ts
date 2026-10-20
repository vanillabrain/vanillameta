import { DashboardDraft, quoteColumn, validateSourceSql } from './dashboard-draft';
import { resolveDimensionColumn } from './dashboard-dimension';
import { resolveTimeChartBucket } from './dashboard-trend';
import { createHash } from 'crypto';

export const CONTRIBUTION_UNAVAILABLE =
  '이 SQL의 집계 입력 행을 안전하게 확인할 수 없습니다. DISTINCT·HAVING·윈도 함수 또는 지원하지 않는 계산식을 확인해 주세요.';
export const CONTRIBUTION_GROUP_LIMIT = 240;
export function contributionGroupFingerprint(values: unknown[]): string | undefined {
  if (
    values.length > CONTRIBUTION_GROUP_LIMIT ||
    values.some(
      value =>
        !(
          value === null ||
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value))
        ),
    )
  )
    return undefined;
  const keys = [
    ...new Set(
      values.map(value => JSON.stringify([value === null ? 'null' : typeof value, value])),
    ),
  ].sort();
  return createHash('sha256').update(JSON.stringify(keys)).digest('hex');
}
export type ContributionPlan =
  | {
      supported: true;
      components: string[];
      eligibility: string[];
      where: string;
      categoryExpression?: string;
      semantics: string;
    }
  | { supported: false; reason: string };
type Component = { name: string; eligible: string };
const aggregate = /^(sum|avg|count|min|max|count_if)$/i;
const scalar =
  /^(round|coalesce|nullif|abs|floor|ceil|if|lower|upper|trim|length|date_trunc|strftime|extract)$/i;
const identifier = (token: string) =>
  /^"(?:""|[^"])+"$/.test(token)
    ? token.slice(1, -1).replace(/""/g, '"')
    : /^[A-Za-z_][A-Za-z_0-9]*$/.test(token)
    ? token
    : undefined;
const tokenize = (sql: string) =>
  sql.match(
    /'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|>=|<=|<>|!=|[^\s]/g,
  ) || [];

/** Small expression parser: columns only inside row arguments, aggregates only in the measure. */
class Expression {
  private index = 0;
  readonly components: Component[] = [];
  constructor(private readonly tokens: string[], private readonly columns: string[]) {}
  private fail(): never {
    throw new Error('unsupported expression');
  }
  private word() {
    return this.tokens[this.index]?.toLowerCase();
  }
  private take(word: string) {
    if (this.word() !== word) this.fail();
    this.index++;
  }
  private expr(row: boolean, aggregates: boolean, min = 0) {
    this.atom(row, aggregates);
    const priority = {
      or: 1,
      and: 2,
      '=': 3,
      '!=': 3,
      '<>': 3,
      '<': 3,
      '>': 3,
      '<=': 3,
      '>=': 3,
      is: 3,
      in: 3,
      between: 3,
      '+': 4,
      '-': 4,
      '*': 5,
      '/': 5,
      '%': 5,
    };
    while (priority[this.word()] >= min) {
      const op = this.word();
      const level = priority[op];
      this.index++;
      if (op === 'is') {
        if (this.word() === 'not') this.index++;
        if (!['null', 'true', 'false'].includes(this.word())) this.fail();
        this.index++;
      } else if (op === 'in') {
        this.take('(');
        this.expr(row, aggregates);
        while (this.word() === ',') {
          this.index++;
          this.expr(row, aggregates);
        }
        this.take(')');
      } else if (op === 'between') {
        this.expr(row, aggregates, level + 1);
        this.take('and');
        this.expr(row, aggregates, level + 1);
      } else this.expr(row, aggregates, level + 1);
    }
  }
  private atom(row: boolean, aggregates: boolean) {
    const token = this.tokens[this.index];
    const word = this.word();
    if (!token) this.fail();
    if (['+', '-', 'not'].includes(word)) {
      this.index++;
      this.expr(row, aggregates, word === 'not' ? 3 : 6);
      return;
    }
    if (token === '(') {
      this.index++;
      this.expr(row, aggregates);
      this.take(')');
      return;
    }
    if (word === 'case') {
      this.index++;
      if (this.word() !== 'when') this.expr(row, aggregates);
      this.take('when');
      this.expr(row, aggregates);
      this.take('then');
      this.expr(row, aggregates);
      while (this.word() === 'when') {
        this.index++;
        this.expr(row, aggregates);
        this.take('then');
        this.expr(row, aggregates);
      }
      if (this.word() === 'else') {
        this.index++;
        this.expr(row, aggregates);
      }
      this.take('end');
      return;
    }
    if (
      /^'(?:''|[^'])*'$/.test(token) ||
      /^\d+(?:\.\d+)?$/.test(token) ||
      ['null', 'true', 'false'].includes(word)
    ) {
      this.index++;
      return;
    }
    if (this.tokens[this.index + 1] === '(') {
      const start = this.index;
      this.index += 2;
      if (aggregate.test(word)) {
        if (!aggregates) this.fail();
        const argumentStart = this.index;
        if (word === 'count' && this.word() === '*') this.index++;
        else this.expr(true, false);
        const argument = this.tokens.slice(argumentStart, this.index).join(' ');
        this.take(')');
        const name = `${word.toUpperCase()}(${argument})`;
        if (!this.components.some(component => component.name === name))
          this.components.push({
            name,
            eligible:
              argument === '*'
                ? 'TRUE'
                : word === 'count_if'
                ? `((${argument}) IS TRUE)`
                : `((${argument}) IS NOT NULL)`,
          });
        if (this.components.length > 16) this.fail();
      } else if (word === 'cast' || word === 'try_cast') {
        this.expr(row, aggregates);
        this.take('as');
        if (
          !/^(integer|int|bigint|smallint|tinyint|ubigint|double|float|real|boolean|varchar|text|date|timestamp|timestamptz)$/i.test(
            this.tokens[this.index] || '',
          )
        )
          this.fail();
        this.index++;
        this.take(')');
      } else {
        if (!scalar.test(word) || word === 'extract') this.fail();
        this.expr(row, aggregates);
        while (this.word() === ',') {
          this.index++;
          this.expr(row, aggregates);
        }
        this.take(')');
      }
      if (this.index <= start) this.fail();
      return;
    }
    if (!row) this.fail();
    let name = identifier(token);
    this.index++;
    if (word === 'source' && this.word() === '.') {
      this.index++;
      name = identifier(this.tokens[this.index++]);
    }
    if (
      !name ||
      this.columns.filter(column => column.toLowerCase() === name.toLowerCase()).length !== 1
    )
      this.fail();
  }
  parse(row: boolean) {
    this.expr(row, !row);
    if (this.index !== this.tokens.length) this.fail();
    return this.components;
  }
}

export function compileContribution(
  widget: DashboardDraft['widgets'][number],
  schema: Array<{ column_name: string; column_type: string }>,
): ContributionPlan {
  try {
    if (widget.valueField === '__proto__' || widget.categoryField === '__proto__')
      throw new Error();
    validateSourceSql(widget.sql);
    const words = tokenize(widget.sql);
    if (words.some(word => /^(distinct|having|over|offset|qualify|window|filter)$/i.test(word)))
      throw new Error();
    let depth = 0;
    const top = words.flatMap((word, index) => {
      const result = depth === 0 ? [{ word: word.toLowerCase(), index }] : [];
      if (word === '(') depth++;
      if (word === ')') depth--;
      if (depth < 0) throw new Error();
      return result;
    });
    if (depth !== 0) throw new Error();
    const clause = (word: string) => {
      const matches = top.filter(token => token.word === word);
      if (matches.length > 1) throw new Error();
      return matches[0]?.index ?? -1;
    };
    const from = clause('from'),
      where = clause('where'),
      group = clause('group'),
      order = clause('order'),
      limit = clause('limit');
    if (from < 0 || words[from + 1]?.toLowerCase() !== 'source') throw new Error();
    const after = [where, group, order, limit].filter(i => i >= 0);
    if (
      after.length
        ? after[0] !== from + 2 || after.some((i, j) => j && i <= after[j - 1])
        : from + 2 !== words.length
    )
      throw new Error();
    if (where >= 0 && where + 1 === (after[1] ?? words.length)) throw new Error();
    if (
      limit >= 0 &&
      (limit !== words.length - 2 ||
        !/^\d+$/.test(words[limit + 1]) ||
        !Number.isSafeInteger(Number(words[limit + 1])) ||
        Number(words[limit + 1]) < 1)
    )
      throw new Error();
    const commas = top
      .filter(token => token.word === ',' && token.index < from)
      .map(token => token.index);
    const cuts = [0, ...commas, from];
    const projections = cuts.slice(0, -1).map((cut, i) => {
      const tokens = words.slice(cut + 1, cuts[i + 1]);
      const aliased = tokens[tokens.length - 2]?.toLowerCase() === 'as';
      const expression = aliased ? tokens.slice(0, -2) : tokens;
      const alias = aliased
        ? identifier(tokens[tokens.length - 1])
        : expression.length === 1
        ? identifier(expression[0])
        : undefined;
      return { expression, alias };
    });
    const numeric = widget.type === 'BOARD_NUMERIC';
    if (
      projections.length !== (numeric ? 1 : 2) ||
      projections.some(p => !p.alias) ||
      new Set(projections.map(p => p.alias.toLowerCase())).size !== projections.length
    )
      throw new Error();
    const measure = projections.find(p => p.alias === widget.valueField);
    if (!measure) throw new Error();
    const columns = schema.map(column => column.column_name);
    const temporal = schema
      .filter(column => /^(DATE|TIMESTAMP)/i.test(column.column_type))
      .map(column => column.column_name);
    let categoryExpression: string | undefined;
    if (numeric) {
      if (group >= 0) throw new Error();
      if (order >= 0) {
        const tokens = words.slice(order + 1, limit >= 0 ? limit : words.length);
        if (tokens.shift()?.toLowerCase() !== 'by') throw new Error();
        if (/^(asc|desc)$/i.test(tokens[tokens.length - 1])) tokens.pop();
        if (tokens.length !== 1 || identifier(tokens[0]) !== widget.valueField) throw new Error();
      }
    } else {
      const category = projections.find(p => p.alias === widget.categoryField);
      if (!category || category === measure || group < 0) throw new Error();
      const dimension = resolveDimensionColumn(widget.sql, widget.categoryField, columns, temporal);
      const bucket = resolveTimeChartBucket(
        widget.sql,
        widget.valueField,
        widget.categoryField,
        schema,
      );
      if (!dimension && !bucket) throw new Error();
      categoryExpression = dimension ? quoteColumn(dimension) : category.expression.join(' ');
    }
    const components = new Expression(measure.expression, columns).parse(false);
    if (!components.length) throw new Error();
    const whereEnd = [group, order, limit].find(i => i >= 0) ?? words.length;
    const predicate = where >= 0 ? words.slice(where + 1, whereEnd) : [];
    if (predicate.length) new Expression(predicate, columns).parse(true);
    return {
      supported: true,
      components: components.map(component => component.name),
      eligibility: components.map(component => component.eligible),
      where: predicate.join(' '),
      ...(categoryExpression ? { categoryExpression } : {}),
      semantics:
        '집계 함수별 입력 행의 합집합입니다. 일반 집계는 NULL 입력을 제외하고 COUNT(*)는 모든 행, COUNT_IF는 참인 행을 포함합니다. 0과 중복 원본 행을 유지합니다. MIN/MAX는 최솟값·최댓값을 만든 행만이 아니라 모든 비NULL 입력 행입니다.',
    };
  } catch {
    return { supported: false, reason: CONTRIBUTION_UNAVAILABLE };
  }
}
