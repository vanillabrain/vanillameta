import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  const pending = useRef(false);
  const input = {
    dashboardId,
    selectedWidget,
    metricId: metric?.id,
    expectedDefinitionVersion: metric?.definitionVersion,
    expectedRevision: draft.revision,
    calculation,
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
    setError('');
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
  const run = async (save = false) => {
    if (pending.current || (save && (!preview || stale))) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = responseData(await post(`/ai/metric-change/${save ? 'save' : 'preview'}`, input, { timeout: 180000 }));
      if (save) {
        if (result.id !== dashboardId) throw new Error('계산식 변경을 저장하지 못했습니다.');
        onApplied({ ...preview.draft, revision: result.revision });
        onClose();
      } else {
        if (!validPreview(result) || result.metric?.id !== metric.id) throw new Error('미리보기를 확인하지 못했습니다.');
        setPreview({ ...result, signature });
      }
    } catch (e) {
      setError(errorMessage(e));
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
            저장하면 지표와 선택한 차트의 계산식이 함께 변경됩니다. 다른 분석은 현재 계산식을 유지합니다.
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
          {error && <Alert severity="error">{error}</Alert>}
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
          {busy ? '처리 중…' : '지표·분석 저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
