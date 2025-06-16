/**
 * Enhanced Analytics Service for VanillaMeta
 * 사용자 행동 분석을 위한 통합 이벤트 추적 시스템
 */

import { trackEvent as gaTrackEvent, trackPageView as gaTrackPageView, trackTiming } from './analytics';

// 이벤트 타입 정의
export enum EventCategory {
  DASHBOARD = 'Dashboard',
  WIDGET = 'Widget',
  DATA = 'Data',
  USER = 'User',
  PERFORMANCE = 'Performance',
  ERROR = 'Error',
}

export enum EventAction {
  // Dashboard Actions
  DASHBOARD_CREATED = 'dashboard_created',
  DASHBOARD_VIEWED = 'dashboard_viewed',
  DASHBOARD_EDITED = 'dashboard_edited',
  DASHBOARD_DELETED = 'dashboard_deleted',
  DASHBOARD_SHARED = 'dashboard_shared',
  DASHBOARD_DUPLICATED = 'dashboard_duplicated',
  
  // Widget Actions
  WIDGET_CREATED = 'widget_created',
  WIDGET_EDITED = 'widget_edited',
  WIDGET_DELETED = 'widget_deleted',
  WIDGET_RESIZED = 'widget_resized',
  WIDGET_MOVED = 'widget_moved',
  WIDGET_INTERACTED = 'widget_interacted',
  
  // Data Actions
  DATABASE_CONNECTED = 'database_connected',
  DATABASE_DISCONNECTED = 'database_disconnected',
  DATASET_CREATED = 'dataset_created',
  DATASET_EDITED = 'dataset_edited',
  QUERY_EXECUTED = 'query_executed',
  QUERY_FAILED = 'query_failed',
  DATA_EXPORTED = 'data_exported',
  
  // User Actions
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_SKIPPED = 'onboarding_skipped',
  PROFILE_UPDATED = 'profile_updated',
  
  // Performance Actions
  PAGE_LOAD_TIME = 'page_load_time',
  API_RESPONSE_TIME = 'api_response_time',
  CHART_RENDER_TIME = 'chart_render_time',
  
  // Error Actions
  ERROR_OCCURRED = 'error_occurred',
  ERROR_BOUNDARY_TRIGGERED = 'error_boundary_triggered',
}

// 이벤트 데이터 인터페이스
interface BaseEventData {
  timestamp: string;
  sessionId: string;
  userId?: string;
  correlationId?: string;
}

interface DashboardEventData extends BaseEventData {
  dashboardId: string;
  dashboardName?: string;
  templateUsed?: string;
  widgetCount?: number;
}

interface WidgetEventData extends BaseEventData {
  widgetId: string;
  widgetType: string;
  chartType?: string;
  datasetId?: string;
  dashboardId?: string;
}

interface DataEventData extends BaseEventData {
  databaseId?: string;
  databaseType?: string;
  datasetId?: string;
  queryDuration?: number;
  rowCount?: number;
  errorMessage?: string;
}

interface UserEventData extends BaseEventData {
  registrationMethod?: string;
  loginMethod?: string;
  onboardingStep?: string;
  profileField?: string;
  url?: string;
  title?: string;
}

interface PerformanceEventData extends BaseEventData {
  metricName: string;
  value: number;
  unit: string;
  url?: string;
}

interface ErrorEventData extends BaseEventData {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  componentName?: string;
  url: string;
}

// 이벤트 데이터 타입
export type EventData = 
  | DashboardEventData 
  | WidgetEventData 
  | DataEventData 
  | UserEventData 
  | PerformanceEventData
  | ErrorEventData;

// 프라이버시 설정
interface PrivacySettings {
  anonymizeIp: boolean;
  excludePII: boolean;
  consentGiven: boolean;
  dataRetentionDays: number;
}

// Analytics 서비스 설정
interface AnalyticsConfig {
  enabled: boolean;
  providers: {
    googleAnalytics?: boolean;
    cloudWatch?: boolean;
    customEndpoint?: string;
  };
  privacy: PrivacySettings;
  sampling: {
    enabled: boolean;
    rate: number; // 0-1 사이의 값
  };
  batchSize: number;
  flushInterval: number; // milliseconds
  debug: boolean;
}

class EnhancedAnalyticsService {
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId: string | null = null;
  private eventQueue: Array<{ action: EventAction; category: EventCategory; data: EventData }> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  
  constructor() {
    this.config = this.loadConfig();
    this.sessionId = this.generateSessionId();
    this.setupEventListeners();
    this.startBatchProcessor();
  }
  
  private loadConfig(): AnalyticsConfig {
    return {
      enabled: process.env.NODE_ENV === 'production' || process.env.REACT_APP_ANALYTICS_ENABLED === 'true',
      providers: {
        googleAnalytics: !!process.env.REACT_APP_GA_MEASUREMENT_ID,
        cloudWatch: process.env.REACT_APP_CLOUDWATCH_ENABLED === 'true',
        customEndpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
      },
      privacy: {
        anonymizeIp: true,
        excludePII: true,
        consentGiven: this.checkUserConsent(),
        dataRetentionDays: 90,
      },
      sampling: {
        enabled: true,
        rate: parseFloat(process.env.REACT_APP_ANALYTICS_SAMPLING_RATE || '1.0'),
      },
      batchSize: 10,
      flushInterval: 30000, // 30초
      debug: process.env.NODE_ENV === 'development',
    };
  }
  
  private generateSessionId(): string {
    const stored = sessionStorage.getItem('analytics_session_id');
    if (stored) return stored;
    
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
    return sessionId;
  }
  
  public getSessionId(): string {
    return this.sessionId;
  }
  
  private checkUserConsent(): boolean {
    // 사용자 동의 확인 로직
    return localStorage.getItem('analytics_consent') === 'true';
  }
  
  private setupEventListeners(): void {
    // 온라인/오프라인 상태 추적
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushEvents();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    // 페이지 언로드 시 이벤트 플러시
    window.addEventListener('beforeunload', () => {
      this.flushEvents(true);
    });
    
    // 페이지 가시성 변경 추적
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushEvents();
      }
    });
  }
  
  private startBatchProcessor(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushEvents();
      }
    }, this.config.flushInterval);
  }
  
  /**
   * 사용자 ID 설정
   */
  public setUserId(userId: string | null): void {
    this.userId = userId;
    if (this.config.debug) {
      console.log('[Analytics] User ID set:', userId ? 'USER_***' : null);
    }
  }
  
  /**
   * 사용자 동의 업데이트
   */
  public updateConsent(consent: boolean): void {
    this.config.privacy.consentGiven = consent;
    localStorage.setItem('analytics_consent', consent.toString());
    
    if (!consent) {
      // 동의 철회 시 저장된 데이터 삭제
      this.clearStoredData();
    }
  }
  
  /**
   * 이벤트 추적
   */
  public track(action: EventAction, category: EventCategory, data: Partial<EventData> = {}): void {
    if (!this.config.enabled || !this.config.privacy.consentGiven) {
      return;
    }
    
    // 샘플링 확인
    if (this.config.sampling.enabled && Math.random() > this.config.sampling.rate) {
      return;
    }
    
    // 기본 데이터 추가
    const enrichedData: EventData = {
      ...data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
    } as EventData;
    
    // PII 제거
    if (this.config.privacy.excludePII) {
      this.sanitizeData(enrichedData);
    }
    
    // 이벤트 큐에 추가
    this.eventQueue.push({ action, category, data: enrichedData });
    
    if (this.config.debug) {
      console.log('[Analytics] Event tracked:', { action, category, data: enrichedData });
    }
    
    // 배치 크기 도달 시 즉시 전송
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }
  }
  
  /**
   * 페이지뷰 추적
   */
  public trackPageView(path: string, title?: string): void {
    if (!this.config.enabled || !this.config.privacy.consentGiven) {
      return;
    }
    
    // Google Analytics 페이지뷰
    if (this.config.providers.googleAnalytics) {
      gaTrackPageView(path);
    }
    
    // 커스텀 페이지뷰 이벤트
    this.track(EventAction.DASHBOARD_VIEWED, EventCategory.USER, {
      url: path,
      title,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    } as UserEventData);
  }
  
  /**
   * 성능 메트릭 추적
   */
  public trackPerformance(metricName: string, value: number, unit: string = 'ms'): void {
    this.track(EventAction.PAGE_LOAD_TIME, EventCategory.PERFORMANCE, {
      metricName,
      value,
      unit,
      url: window.location.pathname,
    } as PerformanceEventData);
    
    // Google Analytics 타이밍 추적
    if (this.config.providers.googleAnalytics) {
      trackTiming(metricName, value, 'performance');
    }
  }
  
  /**
   * 에러 추적
   */
  public trackError(error: Error, componentName?: string): void {
    this.track(EventAction.ERROR_OCCURRED, EventCategory.ERROR, {
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: this.config.debug ? error.stack : undefined,
      componentName,
      url: window.location.href,
    } as ErrorEventData);
  }
  
  /**
   * 이벤트 플러시
   */
  private async flushEvents(forceSend: boolean = false): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    if (!this.isOnline && !forceSend) {
      // 오프라인일 때는 로컬 스토리지에 저장
      this.saveToLocalStorage();
      return;
    }
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      // 저장된 오프라인 이벤트도 함께 전송
      const storedEvents = this.loadFromLocalStorage();
      if (storedEvents.length > 0) {
        events.unshift(...storedEvents);
        this.clearLocalStorage();
      }
      
      // 각 프로바이더로 전송
      const promises: Promise<void>[] = [];
      
      if (this.config.providers.googleAnalytics) {
        promises.push(this.sendToGoogleAnalytics(events));
      }
      
      if (this.config.providers.cloudWatch) {
        promises.push(this.sendToCloudWatch(events));
      }
      
      if (this.config.providers.customEndpoint) {
        promises.push(this.sendToCustomEndpoint(events));
      }
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
      // 실패한 이벤트는 다시 큐에 추가
      this.eventQueue.unshift(...events);
    }
  }
  
  /**
   * Google Analytics로 이벤트 전송
   */
  private async sendToGoogleAnalytics(events: Array<{ action: EventAction; category: EventCategory; data: EventData }>): Promise<void> {
    events.forEach(({ action, category, data }) => {
      gaTrackEvent(action, category, JSON.stringify(data));
    });
  }
  
  /**
   * CloudWatch로 이벤트 전송
   */
  private async sendToCloudWatch(events: Array<{ action: EventAction; category: EventCategory; data: EventData }>): Promise<void> {
    // CloudWatch API 호출은 백엔드를 통해 처리
    await this.sendToCustomEndpoint(events);
  }
  
  /**
   * 커스텀 엔드포인트로 이벤트 전송
   */
  private async sendToCustomEndpoint(events: Array<{ action: EventAction; category: EventCategory; data: EventData }>): Promise<void> {
    const endpoint = this.config.providers.customEndpoint || '/api/v1/analytics/events';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': this.sessionId,
      },
      body: JSON.stringify({
        events,
        metadata: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          language: navigator.language,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Analytics API returned ${response.status}`);
    }
  }
  
  /**
   * PII 데이터 제거
   */
  private sanitizeData(data: EventData): void {
    // 이메일 패턴 제거
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // IP 주소 패턴 제거
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(emailRegex, '***@***.***').replace(ipRegex, '***.***.***.***');
      }
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          obj[key] = sanitize(obj[key]);
        }
      }
      return obj;
    };
    
    sanitize(data);
  }
  
  /**
   * 로컬 스토리지에 이벤트 저장
   */
  private saveToLocalStorage(): void {
    try {
      const key = 'analytics_offline_events';
      const existing = this.loadFromLocalStorage();
      const combined = [...existing, ...this.eventQueue];
      
      // 최대 100개 이벤트만 저장
      const limited = combined.slice(-100);
      
      localStorage.setItem(key, JSON.stringify(limited));
    } catch (error) {
      console.error('[Analytics] Failed to save to localStorage:', error);
    }
  }
  
  /**
   * 로컬 스토리지에서 이벤트 로드
   */
  private loadFromLocalStorage(): Array<{ action: EventAction; category: EventCategory; data: EventData }> {
    try {
      const key = 'analytics_offline_events';
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[Analytics] Failed to load from localStorage:', error);
      return [];
    }
  }
  
  /**
   * 로컬 스토리지 클리어
   */
  private clearLocalStorage(): void {
    localStorage.removeItem('analytics_offline_events');
  }
  
  /**
   * 저장된 모든 데이터 삭제
   */
  private clearStoredData(): void {
    this.eventQueue = [];
    this.clearLocalStorage();
    sessionStorage.removeItem('analytics_session_id');
  }
}

// 싱글톤 인스턴스
export const analyticsService = new EnhancedAnalyticsService();

// React Hook for Analytics
export const useAnalytics = () => {
  return {
    track: analyticsService.track.bind(analyticsService),
    trackPageView: analyticsService.trackPageView.bind(analyticsService),
    trackPerformance: analyticsService.trackPerformance.bind(analyticsService),
    trackError: analyticsService.trackError.bind(analyticsService),
    setUserId: analyticsService.setUserId.bind(analyticsService),
    updateConsent: analyticsService.updateConsent.bind(analyticsService),
  };
};