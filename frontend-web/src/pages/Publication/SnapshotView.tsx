import React from 'react';
import { Alert, Box, Card, Typography } from '@mui/material';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import MetricTrend from '../Dashboard/Components/MetricTrend';
import { analysisOptions } from '../Dashboard/analysisOptions';
import { responsiveBlockStyle } from '../Dashboard/responsiveBlockStyle';

export type Snapshot = {
  schemaVersion: 1;
  title: string;
  capturedAt: string;
  scope: string;
  widgets: any[];
  responsiveLayouts: any;
};

/** Public rendering consumes only captured data; it never queries a source or grants source access. */
export default function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <Box component="section" aria-label="게시 결과" sx={{ minWidth: 0 }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere', my: 1.5 }}>
        {snapshot.title}
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2 }}>
        {snapshot.scope} · 집계 시점 {snapshot.capturedAt} · 고정된 결과
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(4, minmax(0, 1fr))',
            sm: 'repeat(8, minmax(0, 1fr))',
            md: 'repeat(12, minmax(0, 1fr))',
          },
          gridAutoRows: 'minmax(80px, auto)',
          gap: 1.5,
          minWidth: 0,
        }}
      >
        {snapshot.widgets.map(widget => (
          <Card
            key={widget.blockId}
            sx={{
              ...responsiveBlockStyle(snapshot.responsiveLayouts, widget.blockId),
              border: '1px solid #e2e8f0',
              minWidth: 0,
              overflow: 'hidden',
              minHeight: widget.type === 'BOARD_NUMERIC' ? 300 : 320,
            }}
          >
            <Box sx={{ minWidth: 0, height: widget.type === 'BOARD_NUMERIC' ? 155 : 300 }}>
              <WidgetViewer
                title={widget.title}
                description={widget.description}
                widgetType={widget.type}
                widgetOption={analysisOptions(widget)}
                dataSet={widget.datas}
              />
            </Box>
            {widget.type === 'BOARD_NUMERIC' && (
              <MetricTrend
                title={widget.title}
                trend={widget.trend}
                unavailable={widget.trendUnavailable}
                prefix={widget.prefix}
                suffix={widget.suffix}
                decimalPlaces={widget.decimalPlaces ?? 0}
                numberNotation={widget.numberNotation || 'compact'}
              />
            )}
          </Card>
        ))}
      </Box>
      <Alert severity="info" sx={{ mt: 2 }}>
        게시 시점의 집계 결과입니다. 원본 데이터 갱신과 편집 내용은 재게시 후 반영됩니다.
      </Alert>
    </Box>
  );
}
