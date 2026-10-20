import React from 'react';
import { BusinessBasis, validBusinessBasis } from '@/api/businessBasis';
import { businessTypeLabels } from './businessVariable';
export default function BusinessBasisDetails({ basis }: { basis?: BusinessBasis | null }) {
  if (basis !== undefined && !validBusinessBasis(basis)) return <p role="alert">업무 기준을 확인하지 못했습니다.</p>;
  return (
    <details className="min-w-0 text-sm [overflow-wrap:anywhere]">
      <summary className="cursor-pointer py-2">
        업무 기준 확인 · {basis?.catalogVersion ? `카탈로그 v${basis.catalogVersion}` : '원본 유형 기준'}
      </summary>
      <p>저장된 기준이며 현재 업무 정보로 자동 변경하지 않습니다.</p>
      {basis?.columns.map(c => (
        <p key={c.column}>
          {c.label || c.column} · {c.column} · {c.nativeType} · {businessTypeLabels[c.businessType]}
          {c.dateFormat && ` · ${c.dateFormat}`}
          {c.unit && ` · ${c.unit}`}
          {c.description && ` · ${c.description}`}
          {c.classification && ` · ${c.classification}`}
        </p>
      ))}
    </details>
  );
}
