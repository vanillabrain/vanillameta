import apiHelper, { get } from '@/helpers/apiHelper';
import { TimeRange } from '@/pages/Analytics/types';

export interface AnalyticsQueryParams {
  timeRange?: TimeRange;
  startDate?: string;
  endDate?: string;
  userId?: string;
  sessionId?: string;
  category?: string;
  action?: string;
  groupBy?: string;
  aggregation?: string;
  limit?: number;
  offset?: number;
}

class AnalyticsService {
  // 분석 요약 데이터 조회
  async getAnalyticsSummary(params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/summary', params);
  }

  // 이벤트 목록 조회
  async getEvents(params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/events', params);
  }

  // 성능 메트릭 조회
  async getMetrics(params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/metrics', params);
  }

  // 퍼널 분석
  async getFunnelAnalysis(steps: string[], params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/funnel', {
      ...params,
      steps: steps.join(','),
    });
  }

  // 리텐션 분석
  async getRetentionAnalysis(params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/retention', params);
  }

  // 사용자 플로우 분석
  async getUserFlow(params: AnalyticsQueryParams) {
    return get('/v1/events/analytics/user-flow', params);
  }
}

export default new AnalyticsService();