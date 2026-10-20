import React from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { Node } from '../../Explore/SourceConditions';
import type { StudioDocumentV1 } from './studioTypes';
import type { StudioRunResult } from './studioRunTransport';
import { PublishedBlockView } from './PublishedDashboard';

const operators: Record<string, string> = {
  eq: '같음',
  ne: '다름',
  in: '포함',
  notIn: '포함하지 않음',
  contains: '문자 포함',
  gt: '초과',
  gte: '이상',
  lt: '미만',
  lte: '이하',
  between: '사이',
  isNull: '값 없음',
  isNotNull: '값 있음',
};
function ConditionTree({ node }: { node: Node | null }) {
  if (!node) return <p className="text-sm text-muted-foreground">조건 없음</p>;
  if (node.kind === 'group')
    return (
      <div className="min-w-0 space-y-1">
        <strong className="text-sm">{node.operator === 'and' ? '모두 충족 (AND)' : '하나 이상 충족 (OR)'}</strong>
        <ul className="min-w-0 space-y-1 border-l border-border pl-3">
          {node.children.map((child, index) => (
            <li key={index}>
              <ConditionTree node={child} />
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <p className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
      {node.column} · {operators[node.operator]} {node.values?.map(value => String(value)).join(', ')}
    </p>
  );
}
export default function StudioConditionReview({
  before,
  result,
  disabled,
  onApply,
  onDismiss,
}: {
  before: StudioDocumentV1;
  result: StudioRunResult;
  disabled: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const operation = result.proposedOperations.find(op => op.type === 'setConditions');
  if (!operation || operation.type !== 'setConditions') return null;
  const proposed = operation.conditions?.definition;
  return (
    <section aria-label="AI 조건 변경안 검토" className="my-3 min-w-0 space-y-3 rounded-lg border border-border p-3">
      <h2 className="text-base font-semibold">조건 변경안 검토</h2>
      <Notice severity="info">
        전체 블록에 적용할 변경안입니다. 현재 초안과 저장본은 유지했습니다. 명시 적용 후 따로 저장하세요.
      </Notice>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            { title: '현재 조건', definition: before.conditions?.definition, semantics: before.conditions?.semantics },
            { title: '제안 조건', definition: proposed, semantics: operation.conditions?.semantics },
          ] as const
        ).map(({ title, definition, semantics }) => (
          <div key={title} className="min-w-0 space-y-2 rounded-md border border-border p-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-sm">
              {semantics ? `업무 의미 카탈로그 버전 ${semantics.catalogVersion}` : '원본 유형 기준 (legacy native)'}
            </p>
            {(['include', 'exclude'] as const).map(key => (
              <div key={key} className="min-w-0">
                <h4 className="text-sm font-medium">
                  {key === 'include' ? '포함' : '제외'}
                  {JSON.stringify(before.conditions?.definition[key] ?? null) !== JSON.stringify(proposed?.[key] ?? null)
                    ? ' · 변경됨'
                    : ''}
                </h4>
                <ConditionTree node={definition?.[key] ?? null} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {!operation.conditions && <p className="text-sm">적용하면 포함·제외 조건 전체를 해제합니다.</p>}
      <details open className="min-w-0">
        <summary className="cursor-pointer py-2 text-sm font-medium">
          제안 조건 전체 미리보기 · {result.preview.widgets.length}개 블록
        </summary>
        <div className="grid min-w-0 grid-cols-1 gap-3">
          {result.preview.widgets.map((row, index) => (
            <article
              key={before.blocks[index].id}
              aria-label={before.blocks[index].title + ' 조건 미리보기'}
              className="min-w-0 overflow-hidden rounded-md border border-border p-3"
            >
              <PublishedBlockView
                block={
                  {
                    id: before.blocks[index].id,
                    kind: before.blocks[index].kind,
                    title: before.blocks[index].title,
                    description: before.blocks[index].description,
                    display: before.blocks[index].display,
                    valueField: row.valueField,
                    categoryField: row.categoryField,
                    datas: row.datas,
                    ...(row.trend ? { trend: row.trend } : {}),
                  } as any
                }
              />
            </article>
          ))}
        </div>
      </details>
      {disabled && (
        <p role="status" className="text-sm">
          요청 중이거나 편집 기준이 달라 적용할 수 없습니다. 현재 상태로 다시 질문하세요.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={disabled} onClick={onApply}>
          조건 변경안 적용
        </Button>
        <Button type="button" variant="outline" onClick={onDismiss}>
          현재 조건 유지
        </Button>
      </div>
    </section>
  );
}
