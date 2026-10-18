import React, { useId, useState } from 'react';
import StudioMetricBasis, { MetricBasisDefinition } from './StudioMetricBasis';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TextField } from '@/components/ui/text-field';
type SavedMetric = {
  id: number;
  label: string;
  definitionVersion: number | string;
  definition?: MetricBasisDefinition;
};
export default function StudioMetricPicker({
  metrics,
  selected,
  busy,
  onChange,
}: {
  metrics: SavedMetric[];
  selected: number[];
  busy: boolean;
  onChange: (id: number, checked: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim();
  const query = open ? normalize(search) : '';
  const matches = metrics.filter(metric =>
    normalize(
      [
        metric.label,
        '#' + metric.id,
        metric.definition?.aggregation,
        metric.definition?.column,
        metric.definition?.denominatorColumn,
        metric.definition?.weightColumn,
        metric.definition?.unit,
      ]
        .filter(value => typeof value === 'string')
        .join(' '),
    ).includes(query),
  );
  const matched = new Set(matches.map(metric => metric.id));
  const visible = metrics.filter(metric => matched.has(metric.id) || selected.includes(metric.id));
  return (
    <fieldset className="studio-create-metrics min-w-0">
      <legend>재사용할 저장 지표 · 선택 사항</legend>
      <div className="min-w-0 space-y-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-expanded={open}
          aria-controls={id + '-search'}
          onClick={() => setOpen(!open)}
        >
          저장 지표 검색
        </Button>
        {open && (
          <div id={id + '-search'} className="min-w-0">
            <TextField
              label="지표 이름·열·단위로 검색"
              value={search}
              disabled={busy}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
        )}
        <p role="status" className="text-xs text-muted-foreground">
          검색 결과 {matches.length}개 · 선택 {selected.length}개
          {selected.some(value => !matched.has(value)) ? ' · 선택한 지표는 유지됩니다.' : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          저장된 계산 기준을 참고해 선택하세요. 검색과 상세 확인은 생성안을 바꾸지 않습니다.
        </p>
      </div>
      <div className="studio-create-metric-options min-w-0" role="region" aria-label="재사용 저장 지표 목록" tabIndex={0}>
        {visible.map(metric => {
          const title = `${metric.label} · #${metric.id} · v${metric.definitionVersion}`;
          const definition = metric.definition;
          return (
            <div
              key={metric.id}
              className="mb-2 min-w-0 rounded-md border border-border p-3 text-sm [overflow-wrap:anywhere]"
            >
              <Label htmlFor={id + '-' + metric.id} className="flex min-w-0 items-start gap-2 py-1">
                <Checkbox
                  id={id + '-' + metric.id}
                  disabled={busy}
                  checked={selected.includes(metric.id)}
                  onCheckedChange={checked => onChange(metric.id, checked === true)}
                  className="shrink-0"
                />
                <span className="min-w-0">{title}</span>
              </Label>
              <details className="mt-2 min-w-0 text-xs text-muted-foreground">
                <summary className="cursor-pointer rounded-sm py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  계산 기준 확인 · #{metric.id}
                </summary>
                <StudioMetricBasis definition={definition} />
              </details>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
