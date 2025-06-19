import React, { useContext, useEffect, useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Paper,
  Divider,
} from '@mui/material';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { useAlert } from 'react-alert';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';
import analyticsService from '@/api/analyticsService';
import { TimeRange } from './types';
import AnalyticsSummaryCards from './components/AnalyticsSummaryCards';
import EventsChart from './components/EventsChart';
import TopEventsTable from './components/TopEventsTable';
import FunnelChart from './components/FunnelChart';

const Analytics = () => {
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const snackbar = useAlert(SnackbarContext);
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_7_DAYS);
  const [analyticsData, setAnalyticsData] = useState({
    summary: null,
    events: [],
    metrics: [],
    funnel: null,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    showLoading();
    try {
      const [summaryRes, eventsRes, metricsRes, funnelRes] = await Promise.all([
        analyticsService.getAnalyticsSummary({ timeRange }),
        analyticsService.getEvents({ timeRange, limit: 100 }),
        analyticsService.getMetrics({ timeRange }),
        analyticsService.getFunnelAnalysis(
          ['user_login', 'dashboard_viewed', 'widget_created'],
          { timeRange }
        ),
      ]);

      setAnalyticsData({
        summary: summaryRes.data,
        events: eventsRes.data.events,
        metrics: metricsRes.data,
        funnel: funnelRes.data,
      });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      snackbar.error('분석 데이터를 불러오는데 실패했습니다.');
    } finally {
      hideLoading();
    }
  };

  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Seo title="사용자 행동 분석" />
      
      <PageTitleBox 
        title="사용자 행동 분석"
      >
        <Box sx={{ px: 3, mt: 3 }}>
        {/* 시간 범위 선택 */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>기간</InputLabel>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              label="기간"
            >
              <MenuItem value={TimeRange.LAST_HOUR}>지난 1시간</MenuItem>
              <MenuItem value={TimeRange.LAST_24_HOURS}>지난 24시간</MenuItem>
              <MenuItem value={TimeRange.LAST_7_DAYS}>지난 7일</MenuItem>
              <MenuItem value={TimeRange.LAST_30_DAYS}>지난 30일</MenuItem>
              <MenuItem value={TimeRange.LAST_90_DAYS}>지난 90일</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* 요약 카드 */}
        {analyticsData.summary && (
          <AnalyticsSummaryCards summary={analyticsData.summary} />
        )}

        {/* 차트 섹션 */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {/* 이벤트 추이 차트 */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  이벤트 추이
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <EventsChart events={analyticsData.events} timeRange={timeRange} />
              </CardContent>
            </Card>
          </Grid>

          {/* 상위 이벤트 테이블 */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  상위 이벤트
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {analyticsData.summary && (
                  <TopEventsTable topEvents={analyticsData.summary.topEvents} />
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 퍼널 분석 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  사용자 전환 퍼널
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {analyticsData.funnel && (
                  <FunnelChart funnel={analyticsData.funnel.funnel} />
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 성능 메트릭 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  성능 메트릭
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {analyticsData.metrics.map((metric: any, index: number) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {metric.name.replace(/_/g, ' ').toUpperCase()}
                        </Typography>
                        <Typography variant="h4" sx={{ my: 1 }}>
                          {Math.round(metric.avg)}ms
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          최소: {Math.round(metric.min)}ms / 최대: {Math.round(metric.max)}ms
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
      </PageTitleBox>
    </Box>
  );
};

export default Analytics;