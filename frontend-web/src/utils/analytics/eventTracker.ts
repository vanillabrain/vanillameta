// 향상된 이벤트 추적 시스템
import { 
  AnalyticsEvent, 
  EventProperties, 
  UserProperties, 
  PerformanceMetric,
  SessionInfo,
  EventAction,
  EventCategory 
} from './eventTypes';
import apiHelper from '@/helpers/apiHelper';

// 이벤트 큐 관리
interface EventQueue {
  events: AnalyticsEvent[];
  metrics: PerformanceMetric[];
  lastFlushTime: number;
}

// 프라이버시 설정
interface PrivacySettings {
  anonymizeIp: boolean;
  excludePII: boolean;
  consentGiven: boolean;
}

class EventTracker {
  private static instance: EventTracker;
  private sessionId: string;
  private userId: string | null = null;
  private userProperties: UserProperties | null = null;
  private eventQueue: EventQueue;
  private privacySettings: PrivacySettings;
  private flushInterval: number = 30000; // 30초
  private maxBatchSize: number = 50;
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionInfo: SessionInfo;
  private isOnline: boolean = navigator.onLine;
  private localStorageKey = 'vanillameta_event_queue';
  private sessionStorageKey = 'vanillameta_session_info';

  private constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.eventQueue = {
      events: [],
      metrics: [],
      lastFlushTime: Date.now()
    };
    this.privacySettings = {
      anonymizeIp: true,
      excludePII: true,
      consentGiven: this.checkConsent()
    };
    this.sessionInfo = this.getOrCreateSessionInfo();
    
    this.initializeEventListeners();
    this.loadQueueFromStorage();
    this.startFlushInterval();
  }

  static getInstance(): EventTracker {
    if (!EventTracker.instance) {
      EventTracker.instance = new EventTracker();
    }
    return EventTracker.instance;
  }

  // UUID 생성 헬퍼 함수
  private generateUUID(): string {
    // crypto.randomUUID가 있으면 사용, 없으면 Math.random 기반 생성
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // 폴백: Math.random 기반 UUID v4 생성
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 세션 관리
  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('vanillameta_session_id');
    if (stored) return stored;
    
    const newSessionId = this.generateUUID();
    sessionStorage.setItem('vanillameta_session_id', newSessionId);
    return newSessionId;
  }

  private getOrCreateSessionInfo(): SessionInfo {
    const stored = sessionStorage.getItem(this.sessionStorageKey);
    if (stored) {
      return JSON.parse(stored);
    }
    
    const newSession: SessionInfo = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      pageViews: 0,
      eventCount: 0
    };
    sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(newSession));
    return newSession;
  }

  // 프라이버시 확인
  private checkConsent(): boolean {
    return localStorage.getItem('vanillameta_analytics_consent') === 'true';
  }

  // 사용자 설정
  setUser(userId: string, properties?: Partial<UserProperties>) {
    this.userId = userId;
    if (properties) {
      this.userProperties = {
        userId,
        ...properties
      };
    }
  }

  clearUser() {
    this.userId = null;
    this.userProperties = null;
  }

  // 프라이버시 설정
  setPrivacySettings(settings: Partial<PrivacySettings>) {
    this.privacySettings = { ...this.privacySettings, ...settings };
    if (settings.consentGiven !== undefined) {
      localStorage.setItem('vanillameta_analytics_consent', String(settings.consentGiven));
    }
  }

  // 이벤트 추적
  track(
    action: EventAction,
    category: EventCategory,
    properties?: EventProperties,
    label?: string,
    value?: number
  ) {
    if (!this.privacySettings.consentGiven) {
      console.debug('Analytics consent not given, skipping event:', action);
      return;
    }

    const event: AnalyticsEvent = {
      action,
      category,
      label,
      value,
      properties: {
        ...this.getDefaultProperties(),
        ...properties
      },
      userProperties: this.userProperties || undefined
    };

    // PII 제거
    if (this.privacySettings.excludePII) {
      event.properties = this.removePII(event.properties);
    }

    this.eventQueue.events.push(event);
    this.updateSessionInfo();
    
    // 배치 크기 초과 시 즉시 전송
    if (this.eventQueue.events.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  // 페이지뷰 추적
  trackPageView(path: string, title?: string) {
    this.track(
      EventAction.PAGE_VIEWED,
      EventCategory.NAVIGATION,
      {
        path,
        title: title || document.title,
        referrer: document.referrer
      }
    );
    this.sessionInfo.pageViews++;
    this.saveSessionInfo();
  }

  // 성능 메트릭 추적
  trackPerformance(metric: PerformanceMetric) {
    if (!this.privacySettings.consentGiven) return;
    
    this.eventQueue.metrics.push({
      ...metric,
      tags: {
        ...metric.tags,
        sessionId: this.sessionId
      }
    });
    
    if (this.eventQueue.metrics.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  // 타이밍 추적
  trackTiming(name: string, startTime: number, category?: string) {
    const duration = Date.now() - startTime;
    this.trackPerformance({
      name,
      value: duration,
      category: category || 'timing'
    });
  }

  // 예외 추적
  trackError(error: Error, fatal: boolean = false, context?: Record<string, any>) {
    this.track(
      EventAction.DASHBOARD_VIEWED, // 적절한 에러 액션이 없어서 임시로 사용
      EventCategory.DASHBOARD,
      {
        errorMessage: error.message,
        errorStack: error.stack,
        fatal,
        ...context
      },
      'error'
    );
  }

  // 기본 속성
  private getDefaultProperties(): EventProperties {
    return {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      correlationId: this.generateUUID(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  // PII 제거
  private removePII(properties?: EventProperties): EventProperties | undefined {
    if (!properties) return properties;
    
    const piiFields = ['email', 'phone', 'name', 'address', 'ssn', 'creditCard'];
    const cleaned = { ...properties };
    
    piiFields.forEach(field => {
      delete cleaned[field];
    });
    
    // IP 익명화 (서버에서 처리)
    if (this.privacySettings.anonymizeIp) {
      cleaned.anonymizeIp = true;
    }
    
    return cleaned;
  }

  // 세션 정보 업데이트
  private updateSessionInfo() {
    this.sessionInfo.lastActivityTime = Date.now();
    this.sessionInfo.eventCount++;
    this.saveSessionInfo();
  }

  private saveSessionInfo() {
    sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(this.sessionInfo));
  }

  // 이벤트 전송
  private async flush() {
    if (!this.isOnline || 
        (this.eventQueue.events.length === 0 && this.eventQueue.metrics.length === 0)) {
      return;
    }

    const eventsToSend = [...this.eventQueue.events];
    const metricsToSend = [...this.eventQueue.metrics];
    
    // 큐 비우기
    this.eventQueue.events = [];
    this.eventQueue.metrics = [];
    this.eventQueue.lastFlushTime = Date.now();
    
    try {
      // 백엔드로 이벤트 전송
      if (eventsToSend.length > 0) {
        await apiHelper.post('/v1/events/track', {
          events: eventsToSend,
          sessionInfo: this.sessionInfo
        });
      }
      
      // 성능 메트릭 전송
      if (metricsToSend.length > 0) {
        await apiHelper.post('/v1/events/metrics', {
          metrics: metricsToSend
        });
      }
      
      // 로컬 스토리지에서 제거
      this.clearStoredQueue();
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // 실패한 이벤트는 다시 큐에 추가
      this.eventQueue.events.unshift(...eventsToSend);
      this.eventQueue.metrics.unshift(...metricsToSend);
      this.saveQueueToStorage();
    }
  }

  // 로컬 스토리지 관리
  private saveQueueToStorage() {
    if (!this.isOnline) {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.eventQueue));
    }
  }

  private loadQueueFromStorage() {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.eventQueue.events.unshift(...parsed.events);
        this.eventQueue.metrics.unshift(...parsed.metrics);
        this.clearStoredQueue();
      } catch (error) {
        console.error('Failed to load stored events:', error);
      }
    }
  }

  private clearStoredQueue() {
    localStorage.removeItem(this.localStorageKey);
  }

  // 주기적 전송
  private startFlushInterval() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  // 이벤트 리스너
  private initializeEventListeners() {
    // 온라인/오프라인 상태 감지
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.loadQueueFromStorage();
      this.flush();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    // 페이지 언로드 시 전송
    window.addEventListener('beforeunload', () => {
      if (this.isOnline) {
        this.flush();
      } else {
        this.saveQueueToStorage();
      }
    });
    
    // 가시성 변경 시 전송
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });
  }

  // 정리
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  // 테스트를 위한 리셋 메서드
  __resetForTesting() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.eventQueue = {
      events: [],
      metrics: [],
      lastFlushTime: Date.now()
    };
    this.sessionId = this.getOrCreateSessionId();
    this.sessionInfo = this.getOrCreateSessionInfo();
    this.userId = null;
    this.userProperties = null;
    this.privacySettings = {
      anonymizeIp: true,
      excludePII: true,
      consentGiven: this.checkConsent()
    };
    this.isOnline = navigator.onLine;
    this.startFlushInterval();
  }
}

// 싱글톤 인스턴스 export
export const eventTracker = EventTracker.getInstance();