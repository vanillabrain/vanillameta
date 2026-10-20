import { validClassificationRef } from '@/api/classificationService';
import { Notice } from '@/components/ui/notice';
import { variableText } from './businessVariable';
import React from 'react';
export type CatalogChange = { column: string | null; field: string; before: string | null; after: string | null };
const text = (value: string | null) => (value === null ? '항목 없음' : value === '' ? '빈 값' : value);
const fieldLabel: Record<string, string> = {
  label: '표시명',
  description: '업무 설명',
  unit: '단위',
  businessType: '업무 유형',
  dateFormat: '날짜 형식',
  classification: '업무 분류',
  classificationRef: '공통 분류 연결',
};

export function validCatalogChanges(value: unknown): value is CatalogChange[] {
  if (!Array.isArray(value)) return false;
  return value.every(change => {
    if (
      !change ||
      !(change.column === null || typeof change.column === 'string') ||
      !Object.prototype.hasOwnProperty.call(fieldLabel, change.field)
    )
      return false;
    return [change.before, change.after].every(v => {
      if (v === null) return true;
      if (typeof v !== 'string') return false;
      if (change.field !== 'classificationRef') return true;
      try {
        const ref = JSON.parse(v);
        return ref === null || validClassificationRef(ref);
      } catch {
        return false;
      }
    });
  });
}
/** Same before/after presentation for immutable history and a validated unsaved proposal. */
export default function SourceCatalogChanges({
  changes,
  beforeLabel,
  afterLabel,
}: {
  changes: CatalogChange[];
  beforeLabel: string;
  afterLabel: string;
}) {
  if (!validCatalogChanges(changes))
    return <Notice severity="error">변경 이력의 분류 연결 기준을 확인하지 못했습니다.</Notice>;
  return (
    <>
      {changes.map(change => (
        <div key={JSON.stringify([change.column, change.field])} className="min-w-0 rounded-md border border-border p-3">
          <h3 className="mb-2 text-sm font-medium [overflow-wrap:anywhere]">
            {change.column === null ? '소스' : change.column} · {fieldLabel[change.field] ?? change.field}
          </h3>
          <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{beforeLabel}</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {change.field === 'classificationRef' && change.before === null
                  ? '연결 없음'
                  : text(change.before === null ? null : variableText(change.field, change.before))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{afterLabel}</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {change.field === 'classificationRef' && change.after === null
                  ? '연결 없음'
                  : text(change.after === null ? null : variableText(change.field, change.after))}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </>
  );
}
