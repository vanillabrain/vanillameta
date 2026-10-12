import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { get, post } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import AiDashboardPanel from './AiDashboardPanel';
import { analysisOptions } from '../analysisOptions';

export default function DashboardAnalysis({ dashboardId, onSaved, children }: any) {
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const serial = useRef(0);
  useEffect(() => {
    serial.current += 1;
    const request = serial.current;
    setDraft(null);
    setPreview(null);
    setFilters({});
    setError('');
    get(`/ai/dashboard-analysis/${dashboardId}`)
      .then(response => {
        if (request !== serial.current) return;
        if (response.data.status === 'SUCCESS') setDraft(response.data.data);
        // Ordinary dashboards remain usable if their sources cannot support common filters.
      })
      .catch(() => {
        // Unsupported dashboards keep their standard viewer.
      });
    return () => {
      serial.current += 1;
    };
  }, [dashboardId]);
  useEffect(() => {
    if (!draft) return;
    serial.current += 1;
    const request = serial.current;
    setBusy(true);
    setError('');
    post(
      '/ai/dashboard-preview',
      {
        draft,
        dashboardId: Number(dashboardId),
        filters: Object.entries(filters)
          .filter(([, value]) => value !== '')
          .map(([column, value]) => ({ column, value })),
      },
      { timeout: 60000 },
    )
      .then(response => {
        if (request !== serial.current) return;
        if (response.data.status !== 'SUCCESS') throw new Error(response.data.message || '필터 조회 실패');
        setPreview(response.data.data);
      })
      .catch(e => {
        if (request !== serial.current) return;
        setError(e.response?.data?.message || e.message || '필터 조회 실패');
      })
      .finally(() => {
        if (request === serial.current) setBusy(false);
      });
  }, [draft, filters, dashboardId]);
  if (!draft) return <>{children}</>;
  const dimensions = preview?.dimensions || [];
  const active = Object.entries(filters).filter(([, value]) => value !== '');
  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 13, mr: 'auto' }}>
          전체 기간 · {active.length ? active.map(([column, value]) => `${column}: ${value}`).join(' · ') : '필터 없음'}
        </Typography>
        <Button size="small" onClick={() => setFilters({})} disabled={busy || !active.length}>
          필터 초기화
        </Button>
        <Button size="small" variant="outlined" onClick={() => setEditing(true)}>
          AI로 수정
        </Button>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {dimensions.slice(0, 5).map((dimension: any) => (
          <FormControl key={dimension.column} size="small" sx={{ minWidth: 150, flex: '1 1 150px', maxWidth: { sm: 250 } }}>
            <InputLabel id={`filter-${dimension.column}`}>{dimension.column}</InputLabel>
            <Select
              labelId={`filter-${dimension.column}`}
              label={dimension.column}
              value={filters[dimension.column] || ''}
              disabled={busy}
              onChange={e => setFilters(values => ({ ...values, [dimension.column]: String(e.target.value) }))}
            >
              <MenuItem value="">전체</MenuItem>
              {dimension.values.map((value: any) => (
                <MenuItem key={String(value)} value={String(value)}>
                  {String(value)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}
      </Stack>
      {busy && <LinearProgress aria-label="공통 필터 집계 중" sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button onClick={() => setFilters({})}>전체 데이터로 복구</Button>
        </Alert>
      )}
      {preview ? (
        <Box
          aria-busy={busy}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
            opacity: busy || error ? 0.4 : 1,
            pointerEvents: busy || error ? 'none' : 'auto',
          }}
        >
          {preview.widgets.map((widget: any, i: number) => (
            <Card
              key={i}
              sx={{
                height: widget.type === 'BOARD_NUMERIC' ? 180 : 460,
                gridColumn: widget.type === 'BOARD_NUMERIC' ? 'auto' : '1 / -1',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: '0 2px 6px rgba(42,50,62,.06)',
              }}
            >
              <WidgetViewer
                title={widget.title}
                description={`${active.length ? '선택한 필터 적용' : '전체 기간 · 필터 없음'} · ${
                  widget.type === 'BOARD_NUMERIC'
                    ? widget.description?.replace(/전체 기간[^·]*· 필터 없음 · [\d,]+행/g, '원본 데이터 집계') || ''
                    : `${widget.datas.length}개 항목`
                }`}
                widgetType={widget.type}
                widgetOption={analysisOptions(widget)}
                dataSet={widget.datas}
              />
            </Card>
          ))}
        </Box>
      ) : (
        children
      )}
      <AiDashboardPanel
        open={editing}
        onClose={() => setEditing(false)}
        dashboardId={Number(dashboardId)}
        currentDraft={draft}
        onSaved={id => {
          setEditing(false);
          onSaved(id);
        }}
      />
    </Box>
  );
}
