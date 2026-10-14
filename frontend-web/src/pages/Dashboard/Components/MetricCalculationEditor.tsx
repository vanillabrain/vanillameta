import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { get, post } from '@/helpers/apiHelper';
import { errorMessage, responseData, validPreview } from '../dashboardPreview';
import { analysisFieldSx } from '@/components/analysis/AnalysisUi';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from './MetricTrend';

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
  const mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
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
    <TextField
      key={key}
      select
      fullWidth
      size="small"
      label={label}
      value={calculation[key] ?? ''}
      disabled={busy}
      sx={analysisFieldSx}
      onChange={e => setCalculation(c => ({ ...c, [key]: e.target.value }))}
    >
      {options.map(c => (
        <MenuItem key={c.name} value={c.name}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>
  );
  const target = preview?.widgets[selectedWidget];
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullScreen={mobile}
      fullWidth
      maxWidth="sm"
      aria-labelledby="metric-change-title"
    >
      <DialogTitle id="metric-change-title">저장 지표 계산식 변경</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography fontSize={13}>
            {metric?.label} · {draft.widgets[selectedWidget]?.title}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            저장하면 지표와 선택한 분석의 계산식이 함께 변경됩니다. 연결된 다른 분석을 확인해 함께 반영할 수 있습니다.
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="집계 방식"
            value={calculation.aggregation ?? ''}
            disabled={busy}
            sx={analysisFieldSx}
            onChange={e => setCalculation(c => ({ ...c, aggregation: e.target.value }))}
          >
            {Object.entries(aggregations).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
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
              <TextField
                select
                size="small"
                label="비율 표시"
                value={calculation.scale}
                disabled={busy}
                sx={analysisFieldSx}
                onChange={e => setCalculation(c => ({ ...c, scale: Number(e.target.value) }))}
              >
                <MenuItem value={1}>비율</MenuItem>
                <MenuItem value={100}>백분율</MenuItem>
              </TextField>
            </>
          )}
          {calculation.aggregation === 'WEIGHTED_AVG' &&
            field(
              'weightColumn',
              '가중치 컬럼',
              columns.filter(c => c.numeric),
            )}
          <Button disabled={busy} onClick={loadImpact} sx={{ alignSelf: 'flex-start' }}>
            같은 지표를 쓰는 분석 확인
          </Button>
          {impact && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Typography fontSize={13} fontWeight={700}>
                영향받는 분석 · {impact.analyses.length}개
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                현재 분석을 포함해 최대10개 선택합니다. 연결 정보가 없는 이전 분석은 자동 포함하지 않습니다.
              </Typography>
              {impact.analyses.map(a => (
                <Box key={a.dashboardId}>
                  <FormControlLabel
                    sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedAnalyses.includes(a.dashboardId)}
                        disabled={
                          busy ||
                          a.dashboardId === dashboardId ||
                          (!selectedAnalyses.includes(a.dashboardId) && selectedAnalyses.length >= 10)
                        }
                        onChange={(_, checked) =>
                          setSelectedAnalyses(ids =>
                            checked ? [...ids, a.dashboardId] : ids.filter(id => id !== a.dashboardId),
                          )
                        }
                      />
                    }
                    label={
                      <Typography fontSize={12} sx={{ py: 1, overflowWrap: 'anywhere' }}>
                        {a.title} · {a.widgetIndices.length}개 차트
                        {a.definitionVersions?.length ? ` · 저장 v${a.definitionVersions.join('/v')}` : ' · 연결 지정'}
                        {a.dashboardId === dashboardId ? ' · 현재 분석' : ''}
                      </Typography>
                    }
                  />
                </Box>
              ))}
              <Typography fontSize={12} color="text.secondary">
                선택 {selectedAnalyses.length}개 · 미연결 분석 {impact.unlinked}개 제외
              </Typography>
            </Box>
          )}
          {error && (
            <Alert severity="error">
              {error}
              {conflict && <Button onClick={() => window.location.reload()}>최신 화면 불러오기</Button>}
            </Alert>
          )}
          {stale && <Alert severity="warning">조건이 바뀌었습니다. 다시 미리보기해 주세요.</Alert>}
          {preview && (
            <>
              <Typography fontSize={12}>
                v{preview.metric.definitionVersion} → v{preview.metric.nextVersion}
              </Typography>
              <Box component="pre" sx={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', m: 0 }}>
                기존: {preview.metric.previousExpression}
                {'\n'}변경: {preview.metric.expression}
              </Box>
              <Box sx={{ height: target.type === 'BOARD_NUMERIC' ? 150 : 280 }}>
                <WidgetViewer
                  title={target.title}
                  widgetType={target.type}
                  widgetOption={analysisOptions(target, target.numberNotation || 'compact')}
                  dataSet={target.datas}
                />
              </Box>
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
                  <Box component="details" key={a.dashboardId}>
                    <Typography component="summary" fontSize={13} sx={{ cursor: 'pointer' }}>
                      분석 미리보기: {a.title} · {indices.length}개 차트
                    </Typography>
                    {indices.map(i => {
                      const w = a.preview.widgets[i];
                      return (
                        <Box
                          key={i}
                          sx={{ minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, mt: 1 }}
                        >
                          <Box sx={{ height: w.type === 'BOARD_NUMERIC' ? 150 : 280 }}>
                            <WidgetViewer
                              title={w.title}
                              widgetType={w.type}
                              widgetOption={analysisOptions(w, w.numberNotation || 'compact')}
                              dataSet={w.datas}
                            />
                          </Box>
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
                        </Box>
                      );
                    })}
                  </Box>
                ) : null;
              })}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button disabled={busy || !columns.length} onClick={() => run()}>
          계산식 미리보기
        </Button>
        <Button variant="contained" disabled={busy || !preview || stale} onClick={() => run(true)}>
          {busy ? '처리 중…' : impact ? '지표·분석 일괄 저장' : '지표·분석 저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
