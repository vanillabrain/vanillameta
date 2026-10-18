import React from 'react';
export type MetricBasisDefinition = {
  aggregation?: string;
  column?: string;
  denominatorColumn?: string;
  weightColumn?: string;
  scale?: number;
  unit?: string;
};
/** Read the proposal's own definition; never infer defaults or fetch a newer metric. */
export default function StudioMetricBasis({ definition }: { definition?: MetricBasisDefinition }) {
  if (typeof definition?.aggregation !== 'string' || !definition.aggregation.trim())
    return <p>계산 기준을 확인하지 못했습니다.</p>;
  const fields: Array<[keyof MetricBasisDefinition, string]> = [
    ['aggregation', '집계 방식'],
    ['column', '대상 열'],
  ];
  if (definition.aggregation === 'RATIO_SUM' || definition.denominatorColumn !== undefined)
    fields.push(['denominatorColumn', '분모 열']);
  if (definition.aggregation === 'WEIGHTED_AVG' || definition.weightColumn !== undefined)
    fields.push(['weightColumn', '가중치 열']);
  if (definition.aggregation === 'RATIO_SUM' || definition.scale !== undefined) fields.push(['scale', '배율']);
  return (
    <dl className="mt-2 min-w-0 space-y-1 [overflow-wrap:anywhere]">
      {fields.map(([key, label]) => {
        const value = definition[key];
        const present =
          key === 'scale'
            ? typeof value === 'number' && Number.isFinite(value)
            : typeof value === 'string' && !!value.trim();
        return (
          <div key={key} className="flex min-w-0 flex-wrap gap-x-2">
            <dt>{label}</dt>
            <dd>{present ? value : '미확인'}</dd>
          </div>
        );
      })}
      <div className="flex min-w-0 flex-wrap gap-x-2">
        <dt>단위</dt>
        <dd>{typeof definition.unit === 'string' && definition.unit.trim() ? definition.unit : '미지정'}</dd>
      </div>
    </dl>
  );
}
