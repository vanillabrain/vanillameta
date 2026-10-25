import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import { CreationMetric, CreationSemantic } from './studioCreation';
import { KIND_LABELS } from './StudioInspector';

const PRESENTATION_LABELS: Record<string, string> = { visual: '차트', table: '표', summary: '요약' };
const kindLabel = (kind: string) => (KIND_LABELS as Record<string, string>)[kind] ?? kind;

// Display-only fields: a different label, unit or number format does not change what is computed.
const DISPLAY_ONLY = ['label', 'businessBasis', 'unit', 'decimalPlaces', 'numberNotation'];
const sameCalculation = (a: CreationMetric, b: CreationMetric) => isEqual(omit(a, DISPLAY_ONLY), omit(b, DISPLAY_ONLY));

/** Short description of what a block computes, including every field that changes the computed value. */
const calculation = (metric: CreationMetric) => {
  const saved = metric.id ? `저장 지표 #${metric.id} v${metric.definitionVersion}` : '';
  if (metric.aggregation === 'FORMULA') return saved ? `${saved} (조합)` : '새 조합 지표';
  const parts = [`${metric.aggregation ?? '저장된 계산'}${metric.column ? `(${metric.column})` : ''}`];
  if (metric.denominatorColumn) parts.push(`분모 ${metric.denominatorColumn}`);
  if (metric.weightColumn) parts.push(`가중치 ${metric.weightColumn}`);
  if (metric.scale !== undefined) parts.push(`배율 ${metric.scale}`);
  return [saved, parts.join(' · ')].filter(Boolean).join(' · ');
};
const dimension = (block: CreationSemantic) => block.dimension?.column ?? '없음';
const presentation = (block: CreationSemantic) =>
  typeof block.presentation === 'string' ? PRESENTATION_LABELS[block.presentation] ?? block.presentation : '';

/**
 * Plain-language summary of what a refinement changed in one block. It compares the structured fields
 * the server returned and never judges the title text, so a title that no longer matches the calculation
 * is visible as "only the title changed" instead of being guessed at from the wording.
 */
export function describeBlockChange(
  before: CreationSemantic | undefined,
  after: CreationSemantic | undefined,
): string | null {
  if (!after) return null;
  if (!before) return `새 블록 "${after.title}": 계산 ${calculation(after.metric)} · 차원 ${dimension(after)}`;
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`제목 "${before.title}" → "${after.title}"`);
  if (before.kind !== after.kind) changes.push(`차트 종류 ${kindLabel(before.kind)} → ${kindLabel(after.kind)}`);
  if (!sameCalculation(before.metric, after.metric)) {
    const [from, to] = [calculation(before.metric), calculation(after.metric)];
    changes.push(from === to ? `계산 세부 설정(${to})` : `계산 ${from} → ${to}`);
  }
  if (dimension(before) !== dimension(after)) changes.push(`차원 ${dimension(before)} → ${dimension(after)}`);
  if (presentation(before) !== presentation(after))
    changes.push(`표시 방식 ${presentation(before) || '없음'} → ${presentation(after) || '없음'}`);
  if (!changes.length) return null;
  if (changes.length === 1 && before.title !== after.title)
    return `${changes[0]}. 제목 외에 계산은 ${calculation(after.metric)}, 차원은 ${dimension(
      after,
    )} 그대로입니다. 제목이 내용과 맞는지 확인하세요.`;
  return `바뀐 내용: ${changes.join(', ')}.`;
}
