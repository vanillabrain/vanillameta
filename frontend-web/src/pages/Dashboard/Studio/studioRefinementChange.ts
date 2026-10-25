import { CreationSemantic } from './studioCreation';

const calculation = ({ metric }: CreationSemantic) => {
  if (metric.aggregation === 'FORMULA') return '저장 지표 조합';
  const detail = `${metric.aggregation ?? '저장된 계산'}${metric.column ? `(${metric.column})` : ''}`;
  return metric.id ? `저장 지표 #${metric.id} v${metric.definitionVersion} · ${detail}` : detail;
};
const dimension = (block: CreationSemantic) => block.dimension?.column ?? '없음';

/**
 * Plain-language summary of what a refinement changed in one block. It compares the structured fields
 * the server returned and never judges the title text, so a title that no longer matches the calculation
 * is visible as "only the title changed" instead of being guessed at from the wording.
 */
export function describeBlockChange(before: CreationSemantic | undefined, after: CreationSemantic): string | null {
  if (!before) return `새 블록 "${after.title}": 계산 ${calculation(after)} · 차원 ${dimension(after)}`;
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`제목 "${before.title}" → "${after.title}"`);
  if (before.kind !== after.kind) changes.push(`차트 종류 ${before.kind} → ${after.kind}`);
  if (calculation(before) !== calculation(after))
    changes.push(`계산 ${calculation(before)} → ${calculation(after)}`);
  if (dimension(before) !== dimension(after)) changes.push(`차원 ${dimension(before)} → ${dimension(after)}`);
  if (!changes.length) return null;
  if (changes.length === 1 && before.title !== after.title)
    return `${changes[0]}. 제목만 바뀌었고 계산(${calculation(after)})과 차원(${dimension(after)})은 그대로입니다. 제목이 내용과 맞는지 확인하세요.`;
  return `바뀐 내용: ${changes.join(', ')}`;
}
