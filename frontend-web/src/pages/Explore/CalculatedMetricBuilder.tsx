import React, { useEffect, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { formatMetric } from '@/utils/formatMetric';

type SavedMetric = { id: number; label: string; definitionVersion: number; definition: { aggregation: string } };
type Reference = { metricId: number; definitionVersion: number };
type Formula =
  | Reference
  | { op: 'subtract'; left: Formula; right: Formula }
  | {
      op: 'ratio';
      left: Formula;
      right: Formula;
      scale: 1 | 100;
    };
type FormulaPreview = {
  sourceRevision: string;
  definition: { unit: string; decimalPlaces: number };
  rows: Array<{ value: unknown }>;
};

/** Only builds a small structured tree. Reference definitions and units are pinned by the server. */
export default function CalculatedMetricBuilder({
  sourceId,
  sourceRevision,
  metrics,
  disabled,
  onCreated,
}: {
  sourceId: number;
  sourceRevision: string;
  metrics: SavedMetric[];
  disabled: boolean;
  onCreated: (metric: any) => void;
}) {
  const available = metrics.filter(metric => metric.definition.aggregation !== 'FORMULA');
  const [name, setName] = useState('');
  const [operation, setOperation] = useState('difference');
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [denominator, setDenominator] = useState('');
  const [decimals, setDecimals] = useState(2);
  const [preview, setPreview] = useState<FormulaPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const versions = available.map(metric => `${metric.id}:${metric.definitionVersion}`).join(',');
  const key = JSON.stringify({ sourceId, sourceRevision, name, operation, left, right, denominator, decimals, versions });
  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    setPreview(null);
    setError('');
    setBusy(false);
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [key]);
  const ref = (id: string): Reference | undefined => {
    const metric = available.find(value => value.id === Number(id));
    return metric && { metricId: metric.id, definitionVersion: metric.definitionVersion };
  };
  const first = ref(left),
    second = ref(right),
    third = ref(denominator);
  const expression: Formula | undefined =
    first &&
    second &&
    (operation === 'difference'
      ? { op: 'subtract', left: first, right: second }
      : operation === 'ratio'
      ? { op: 'ratio', left: first, right: second, scale: 100 }
      : third
      ? { op: 'ratio', left: { op: 'subtract', left: first, right: second }, right: third, scale: 100 }
      : undefined);
  const body = {
    sourceId,
    expectedSourceRevision: sourceRevision,
    label: name.trim(),
    aggregation: 'FORMULA',
    expression,
    decimalPlaces: decimals,
    numberNotation: 'plain',
  };
  const run = async (save: boolean) => {
    if (busy || disabled || !expression || !name.trim() || (save && !preview)) return;
    generation.current += 1;
    const token = generation.current,
      abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    if (!save) setPreview(null);
    try {
      const response = await post(save ? '/bi/metrics' : '/bi/formulas/preview', body, { signal: abort.signal });
      if (generation.current !== token) return;
      if (response?.data?.status !== 'SUCCESS' || !response.data.data) throw new Error('invalid formula response');
      if (save) onCreated(response.data.data);
      else {
        const next = response.data.data;
        if (next.sourceRevision !== sourceRevision || !Array.isArray(next.rows) || typeof next.definition?.unit !== 'string')
          throw new Error('invalid formula preview');
        setPreview(next);
      }
    } catch (cause) {
      if (generation.current !== token || abort.signal.aborted) return;
      const response = (cause as any)?.response;
      const status = Number(response?.status);
      const detail = response?.data?.data ?? response?.data;
      // Map only the known refusal code; never display server messages or SQL details.
      const selfRatio = status === 400 && detail?.code === 'FORMULA_SELF_RATIO';
      setError(
        selfRatio
          ? '분자와 분모가 같은 계산은 비율을 비교할 수 없습니다. 서로 다른 계산을 선택해 주세요. 입력은 유지했습니다.'
          : status === 409
          ? '원본 또는 참조 지표가 변경되었습니다. 데이터를 다시 불러온 뒤 미리보기해 주세요.'
          : status === 403
          ? '참조 지표를 사용할 권한이 없습니다.'
          : '계산 지표를 처리하지 못했습니다. 같은 단위의 지표와 계산 조건을 확인해 주세요. 입력은 유지했습니다.',
      );
    } finally {
      if (generation.current === token) setBusy(false);
    }
  };
  const select = (label: string, value: string, change: (value: string) => void) => (
    <TextField select label={label} value={value} onChange={event => change(event.target.value)} disabled={disabled || busy}>
      <option value="">저장 지표를 선택하세요</option>
      {available.map(metric => (
        <option key={metric.id} value={metric.id}>
          {metric.label} · v{metric.definitionVersion}
        </option>
      ))}
    </TextField>
  );
  return (
    <Card className="min-w-0 gap-4 p-4 md:p-6" aria-label="저장 지표 조합">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">저장 지표로 계산 만들기</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          전체 합계와 각 그룹에서 다시 계산합니다. 참조 지표의 현재 정의를 고정하며, 분모가 0이면 값 없음으로 표시합니다.
        </p>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <TextField
          label="계산 지표 이름"
          value={name}
          maxLength={100}
          disabled={disabled || busy}
          onChange={event => setName(event.target.value)}
        />
        <TextField
          select
          label="계산 방식"
          value={operation}
          disabled={disabled || busy}
          onChange={event => setOperation(event.target.value)}
        >
          <option value="difference">차이 · A − B</option>
          <option value="ratio">백분율 · A ÷ B × 100</option>
          <option value="margin">차이의 백분율 · (A − B) ÷ C × 100</option>
        </TextField>
        {select('지표 A', left, setLeft)}
        {select('지표 B', right, setRight)}
        {operation === 'margin' && select('분모 지표 C', denominator, setDenominator)}
        <TextField
          select
          label="계산 결과 소수 자릿수"
          value={decimals}
          disabled={disabled || busy}
          onChange={event => setDecimals(Number(event.target.value))}
        >
          {Array.from({ length: 7 }, (_, index) => (
            <option key={index} value={index}>
              {index}자리
            </option>
          ))}
        </TextField>
      </div>
      <p className="text-xs text-muted-foreground">
        같은 단위끼리의 차이·비율만 지원합니다. 다른 계산 지표의 재참조는 아직 지원하지 않습니다. 소스 교체·복제 지원 여부는
        블록별로 확인합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={disabled || busy || !expression || !name.trim()} onClick={() => void run(false)}>
          계산 미리보기
        </Button>
        <Button disabled={disabled || busy || !preview} onClick={() => void run(true)}>
          계산 지표 저장
        </Button>
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          계산 지표를 확인하는 중…
        </p>
      )}
      {error && <Notice severity="error">{error}</Notice>}
      {preview && (
        <div role="status" className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">현재 전체 데이터 · 미저장 미리보기</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {
              formatMetric(preview.rows[0]?.value, {
                decimalPlaces: preview.definition.decimalPlaces,
                suffix: preview.definition.unit === '%' ? '%' : preview.definition.unit ? ` ${preview.definition.unit}` : '',
              }).text
            }
          </p>
        </div>
      )}
    </Card>
  );
}
