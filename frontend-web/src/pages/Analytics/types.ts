export enum TimeRange {
  LAST_HOUR = 'last_hour',
  LAST_24_HOURS = 'last_24_hours',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  CUSTOM = 'custom',
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  topEvents: Array<{
    action: string;
    category: string;
    count: number;
  }>;
  eventsByCategory: Array<{
    category: string;
    count: number;
  }>;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface FunnelStep {
  step: string;
  users: number;
  index: number;
  conversionRate: number;
  dropOffRate: number;
}
