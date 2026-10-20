import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get, post } from '@/helpers/apiHelper';
import { errorMessage, responseData, validPreview } from '../dashboardPreview';
import { analysisFieldClassName } from '@/components/analysis/AnalysisUi';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from './MetricTrend';
import { cn } from '@/lib/utils';

const aggregations = {
  SUM: '합계',
  AVG: '평균',
  MIN: '최솟값',
  MAX: '최댓값',
  COUNT: '행 수',
  COUNT_DISTINCT: '고유 개수',
  RATIO_SUM: '합계 비율',
  WEIGHTED_AVG: '가중 평균',
};

function AnalysisSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', analysisFieldClassName, className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function MetricCalculationEditor({
  open,
  onClose,
  metric,
  selectedWidget,
  draft,
  dashboardId,
  filters,
  dateRange,
  trendGrain,
  comparePrevious,
  onApplied,
}: any) {
  const [calculation, setCalculation] = useState<any>({});
  const [columns, setColumns] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [impact, setImpact] = useState<any>(null);
  const [selectedAnalyses, setSelectedAnalyses] = useState<number[]>([]);
  const pending = useRef(false);
  const input = {
    dashboardId,
    selectedWidget,
    metricId: metric?.id,
    expectedDefinitionVersion: metric?.definitionVersion,
    expectedRevision: draft.revision,
    calculation,
    ...(impact
      ? {
          targets: impact.analyses
            .filter(a => selectedAnalyses.includes(a.dashboardId))
            .map(a => ({ dashboardId: a.dashboardId, expectedRevision: a.revision })),
        }
      : {}),
    filters,
    ...(dateRange ? { dateRange } : {}),
    trendGrain,
    comparePrevious,
  };
  const signature = JSON.stringify(input);
  const stale = preview && preview.signature !== signature;
  useEffect(() => {
    if (!open) return;
    let active = true;
    setCalculation({
      aggregation: metric.definition.aggregation,
      column: metric.definition.column,
      denominatorColumn: metric.definition.denominatorColumn,
      weightColumn: metric.definition.weightColumn,
      scale: metric.definition.scale ?? 1,
    });
    setPreview(null);
    setImpact(null);
    setSelectedAnalyses([]);
    setError('');
    setConflict(false);
    setColumns([]);
    get(`/bi/sources/${draft.databaseId}/profile`)
      .then(r => {
        if (active) setColumns(responseData(r).columns);
      })
      .catch(e => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [open, metric, draft.databaseId]);
  const loadImpact = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setConflict(false);
    setPreview(null);
    try {
      const next = responseData(await post('/ai/metric-change/impact', input, { timeout: 180000 }));
      if (!Array.isArray(next.analyses) || !next.analyses.some(a => a.dashboardId === dashboardId))
        throw new Error('영향받는 분석을 확인하지 못했습니다.');
      setImpact(next);
      setSelectedAnalyses(next.analyses.slice(0, 10).map(a => a.dashboardId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const run = async (save = false) => {
    if (pending.current || (save && (!preview || stale))) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setConflict(false);
    try {
      const result = responseData(
        await post(
          `/ai/metric-change/${impact ? (save ? 'batch-save' : 'batch-preview') : save ? 'save' : 'preview'}`,
          input,
          { timeout: 180000 },
        ),
      );
      if (save) {
        if (result.id !== dashboardId) throw new Error('계산식 변경을 저장하지 못했습니다.');
        if (
          impact &&
          (!Array.isArray(result.updatedAnalyses) ||
            result.updatedAnalyses.length !== selectedAnalyses.length ||
            new Set(result.updatedAnalyses).size !== selectedAnalyses.length ||
            result.updatedAnalyses.some(id => !selectedAnalyses.includes(id)))
        )
          throw new Error('일괄 저장 결과를 확인하지 못했습니다. 최신 화면을 확인해 주세요.');
        if (impact)
          onApplied({ ...(result.draft || preview.draft), revision: result.revision }, result.updatedAnalyses?.length);
        else onApplied({ ...(result.draft || preview.draft), revision: result.revision });
        onClose();
      } else {
        if (!validPreview(result) || result.metric?.id !== metric.id) throw new Error('미리보기를 확인하지 못했습니다.');
        if (
          impact &&
          (!Array.isArray(result.analyses) ||
            result.analyses.length !== selectedAnalyses.length ||
            new Set(result.analyses.map(a => a.dashboardId)).size !== selectedAnalyses.length ||
            result.analyses.some(
              a =>
                !selectedAnalyses.includes(a.dashboardId) ||
                !validPreview(a.preview) ||
                a.preview.draft.databaseId !== draft.databaseId ||
                !Array.isArray(a.widgetIndices) ||
                a.widgetIndices.some(i => !Number.isInteger(i) || i < 0 || i >= a.preview.widgets.length),
            ))
        )
          throw new Error('일괄 미리보기를 모두 확인하지 못했습니다.');
        setPreview({ ...result, signature });
      }
    } catch (e) {
      setError(errorMessage(e));
      setConflict(e?.response?.status === 409);
      setPreview(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = (key: string, label: string, options: any[]) => (
    <AnalysisSelect
      key={key}
      id={`metric-calculation-${key}`}
      label={label}
      value={calculation[key] ?? ''}
      disabled={busy}
      options={options.map(c => ({ value: c.name, label: c.name }))}
      onChange={value => setCalculation(c => ({ ...c, [key]: value }))}
    />
  );
  const target = preview?.widgets[selectedWidget];
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby="metric-change-title"
        className="h-full max-h-full w-full max-w-full overflow-y-auto rounded-none sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-xl"
      >
        <DialogTitle id="metric-change-title">저장 지표 계산식 변경</DialogTitle>
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-[13px]">
            {metric?.label} · {draft.widgets[selectedWidget]?.title}
          </p>
          <p className="text-xs text-muted-foreground">
            저장하면 지표와 선택한 분석의 계산식이 함께 변경됩니다. 연결된 다른 분석을 확인해 함께 반영할 수 있습니다.
          </p>
          <AnalysisSelect
            id="metric-calculation-aggregation"
            label="집계 방식"
            value={calculation.aggregation ?? ''}
            disabled={busy}
            options={Object.entries(aggregations).map(([key, label]) => ({ value: key, label: label as string }))}
            onChange={value => setCalculation(c => ({ ...c, aggregation: value }))}
          />
          {calculation.aggregation !== 'COUNT' &&
            field(
              'column',
              '계산 컬럼',
              columns.filter(c => calculation.aggregation === 'COUNT_DISTINCT' || c.numeric),
            )}
          {calculation.aggregation === 'RATIO_SUM' && (
            <>
              {field(
                'denominatorColumn',
                '분모 컬럼',
                columns.filter(c => c.numeric),
              )}
              <AnalysisSelect
                id="metric-calculation-scale"
                label="비율 표시"
                value={String(calculation.scale ?? '')}
                disabled={busy}
                options={[
                  { value: '1', label: '비율' },
                  { value: '100', label: '백분율' },
                ]}
                onChange={value => setCalculation(c => ({ ...c, scale: Number(value) }))}
              />
            </>
          )}
          {calculation.aggregation === 'WEIGHTED_AVG' &&
            field(
              'weightColumn',
              '가중치 컬럼',
              columns.filter(c => c.numeric),
            )}
          <Button variant="ghost" disabled={busy} onClick={loadImpact} className="self-start">
            같은 지표를 쓰는 분석 확인
          </Button>
          {impact && (
            <div className="rounded border border-border p-2">
              <p className="text-[13px] font-bold">영향받는 분석 · {impact.analyses.length}개</p>
              <p className="text-xs text-muted-foreground">
                현재 분석을 포함해 최대10개 선택합니다. 연결 정보가 없는 이전 분석은 자동 포함하지 않습니다.
              </p>
              {impact.analyses.map(a => (
                <div key={a.dashboardId}>
                  <label className="m-0 flex w-full items-start gap-2">
                    <Checkbox
                      className="mt-1"
                      checked={selectedAnalyses.includes(a.dashboardId)}
                      disabled={
                        busy ||
                        a.dashboardId === dashboardId ||
                        (!selectedAnalyses.includes(a.dashboardId) && selectedAnalyses.length >= 10)
                      }
                      onCheckedChange={checked =>
                        setSelectedAnalyses(ids =>
                          checked ? [...ids, a.dashboardId] : ids.filter(id => id !== a.dashboardId),
                        )
                      }
                    />
                    <span className="py-1 text-xs [overflow-wrap:anywhere]">
                      {a.title} · {a.widgetIndices.length}개 차트
                      {a.definitionVersions?.length ? ` · 저장 v${a.definitionVersions.join('/v')}` : ' · 연결 지정'}
                      {a.dashboardId === dashboardId ? ' · 현재 분석' : ''}
                    </span>
                  </label>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                선택 {selectedAnalyses.length}개 · 미연결 분석 {impact.unlinked}개 제외
              </p>
            </div>
          )}
          {error && (
            <Notice severity="error">
              {error}
              {conflict && (
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => window.location.reload()}>
                  최신 화면 불러오기
                </Button>
              )}
            </Notice>
          )}
          {stale && <Notice severity="warning">조건이 바뀌었습니다. 다시 미리보기해 주세요.</Notice>}
          {preview && (
            <>
              <p className="text-xs">
                v{preview.metric.definitionVersion} → v{preview.metric.nextVersion}
              </p>
              <pre className="m-0 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                기존: {preview.metric.previousExpression}
                {'\n'}변경: {preview.metric.expression}
              </pre>
              <div className={target.type === 'BOARD_NUMERIC' ? 'h-[150px]' : 'h-[280px]'}>
                <WidgetViewer
                  title={target.title}
                  widgetType={target.type}
                  widgetOption={analysisOptions(target, target.numberNotation || 'compact')}
                  dataSet={target.datas}
                />
              </div>
              {target.type === 'BOARD_NUMERIC' && (
                <MetricTrend
                  trend={target.trend}
                  unavailable={target.trendUnavailable}
                  title={target.title}
                  prefix={target.prefix}
                  suffix={target.suffix}
                  decimalPlaces={target.decimalPlaces ?? 0}
                  comparison={target.comparison}
                  previousTrend={target.previousTrend}
                  periods={preview.comparison}
                />
              )}
              {preview.analyses?.map(a => {
                const indices = a.widgetIndices.filter(i => a.dashboardId !== dashboardId || i !== selectedWidget);
                return indices.length ? (
                  <details key={a.dashboardId}>
                    <summary className="cursor-pointer text-[13px]">
                      분석 미리보기: {a.title} · {indices.length}개 차트
                    </summary>
                    {indices.map(i => {
                      const w = a.preview.widgets[i];
                      return (
                        <div key={i} className="mt-2 min-w-0 rounded border border-border">
                          <div className={w.type === 'BOARD_NUMERIC' ? 'h-[150px]' : 'h-[280px]'}>
                            <WidgetViewer
                              title={w.title}
                              widgetType={w.type}
                              widgetOption={analysisOptions(w, w.numberNotation || 'compact')}
                              dataSet={w.datas}
                            />
                          </div>
                          {w.type === 'BOARD_NUMERIC' && (
                            <MetricTrend
                              trend={w.trend}
                              unavailable={w.trendUnavailable}
                              title={w.title}
                              prefix={w.prefix}
                              suffix={w.suffix}
                              decimalPlaces={w.decimalPlaces ?? 0}
                              comparison={w.comparison}
                              previousTrend={w.previousTrend}
                              periods={a.preview.comparison}
                            />
                          )}
                        </div>
                      );
                    })}
                  </details>
                ) : null;
              })}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button variant="ghost" disabled={busy || !columns.length} onClick={() => run()}>
            계산식 미리보기
          </Button>
          <Button disabled={busy || !preview || stale} onClick={() => run(true)}>
            {busy ? '처리 중…' : impact ? '지표·분석 일괄 저장' : '지표·분석 저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
