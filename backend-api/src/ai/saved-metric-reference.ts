import { BadRequestException } from '@nestjs/common';
import { validateDraft } from './dashboard-draft';

export interface SavedMetricReference {
  id: number;
  label: string;
  expression: string;
}

/** Replace only the named aggregate projection; retain user filters, category expressions and sort. */
function canonicalProjection(sql: string, field: string, expression: string) {
  const tokens = [
    ...sql.matchAll(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[^\s]/g),
  ].map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
  let depth = 0,
    start = 1;
  const replacements: Array<{ start: number; end: number }> = [];
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i].text.toLowerCase();
    if (depth === 0 && (token === ',' || token === 'from')) {
      const part = tokens.slice(start, i);
      const alias = part[part.length - 1]?.text;
      const name = alias?.startsWith('"') ? alias.slice(1, -1).replace(/""/g, '"') : alias;
      if (part[part.length - 2]?.text.toLowerCase() === 'as' && name === field)
        replacements.push({ start: part[0].start, end: part[part.length - 2].start });
      start = i + 1;
      if (token === 'from') break;
    }
    if (token === '(') depth++;
    else if (token === ')') depth--;
  }
  if (replacements.length !== 1)
    throw new BadRequestException('saved metric requires one explicit value alias');
  const target = replacements[0];
  return sql.slice(0, target.start) + expression + ' ' + sql.slice(target.end);
}

/** UC-002 BR-002/003: persist a canonical calculation snapshot without mutating the stored metric. */
export function applyMetricReferences(
  input: any,
  catalog: SavedMetricReference[],
  columns: string[],
) {
  const draft = validateDraft(input);
  const widgets = draft.widgets.map((w, i) => {
    const id = input.widgets[i].metricId;
    if (id === undefined) return w;
    const metric = catalog.find(m => m.id === id);
    if (!Number.isSafeInteger(id) || !metric)
      throw new BadRequestException('saved metric reference unavailable for this source');
    if (w.type !== 'BOARD_NUMERIC' && !columns.includes(w.categoryField))
      throw new BadRequestException('saved metric chart requires a source category column');
    return { ...w, sql: canonicalProjection(w.sql, w.valueField, metric.expression) };
  });
  return validateDraft({ ...draft, widgets });
}

/** Explicit UI selection targets exactly one chart; unrelated widgets remain immutable. */
export function explicitMetricTarget(
  input: any,
  current: any,
  selectedWidget: any,
  selectedMetricId: any,
) {
  if (selectedMetricId === undefined) return input;
  if (!current || !Number.isInteger(selectedWidget) || !current.widgets[selectedWidget])
    throw new BadRequestException('selected metric requires a target widget');
  if (
    !Array.isArray(input?.widgets) ||
    input.widgets.length !== 1 ||
    input.widgets[0]?.title !== current.widgets[selectedWidget].title
  )
    throw new BadRequestException('return exactly one selected widget with its original title');
  const base = validateDraft(current);
  const widgets = base.widgets.map((w, i) =>
    i === selectedWidget ? { ...input.widgets[0], metricId: selectedMetricId } : w,
  );
  return { ...base, explanation: input.explanation, widgets };
}
