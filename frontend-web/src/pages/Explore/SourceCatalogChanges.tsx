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
};

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
                {text(change.before === null ? null : variableText(change.field, change.before))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{afterLabel}</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {text(change.after === null ? null : variableText(change.field, change.after))}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </>
  );
}
