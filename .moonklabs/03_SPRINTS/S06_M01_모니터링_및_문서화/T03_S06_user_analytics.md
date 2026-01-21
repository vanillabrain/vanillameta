# T03_S06: 사용자 행동 분석 시스템

## 태스크 개요
- **ID**: T03_S06
- **제목**: 사용자 행동 분석 및 사용 패턴 추적 시스템 구축
- **우선순위**: Medium
- **예상 소요 시간**: 3일
- **담당**: 백엔드 개발자, 프론트엔드 개발자

## 목표
사용자의 행동 패턴을 추적하고 분석하여 제품 개선을 위한 인사이트를 도출하고, 사용자 경험을 향상시킬 수 있는 데이터 기반 의사결정을 지원합니다.

## 구현 범위

### 1. 추적 이벤트 정의
```yaml
UserEvents:
  Authentication:
    - user_signup: 회원가입
    - user_login: 로그인
    - user_logout: 로그아웃
    - password_reset: 비밀번호 재설정
  
  Dashboard:
    - dashboard_created: 대시보드 생성
    - dashboard_viewed: 대시보드 조회
    - dashboard_edited: 대시보드 수정
    - dashboard_deleted: 대시보드 삭제
    - dashboard_shared: 대시보드 공유
  
  Visualization:
    - chart_created: 차트 생성
    - chart_type_selected: 차트 타입 선택
    - chart_configured: 차트 설정
    - chart_data_refreshed: 차트 데이터 새로고침
  
  DataSource:
    - datasource_connected: 데이터소스 연결
    - datasource_tested: 연결 테스트
    - datasource_disconnected: 연결 해제
    - query_executed: 쿼리 실행
    - query_saved: 쿼리 저장
  
  UserInteraction:
    - page_viewed: 페이지 조회
    - button_clicked: 버튼 클릭
    - form_submitted: 폼 제출
    - error_encountered: 오류 발생
    - feature_discovered: 기능 발견
```

### 2. 분석 메트릭
```yaml
AnalyticsMetrics:
  UserEngagement:
    - Session_Duration: 세션 지속 시간
    - Pages_Per_Session: 세션당 페이지 수
    - Bounce_Rate: 이탈률
    - Feature_Adoption: 기능 채택률
  
  UserJourney:
    - Onboarding_Completion: 온보딩 완료율
    - Time_To_First_Dashboard: 첫 대시보드 생성 시간
    - Feature_Discovery_Path: 기능 발견 경로
    - Drop_Off_Points: 이탈 지점
  
  FeatureUsage:
    - Most_Used_Charts: 가장 많이 사용되는 차트
    - Query_Complexity: 쿼리 복잡도
    - Dashboard_Complexity: 대시보드 복잡도
    - Sharing_Frequency: 공유 빈도
```

## 기술 구현 가이드

### 1. 이벤트 추적 시스템 (백엔드)
```typescript
// backend-api/src/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';

@Injectable()
export class AnalyticsService {
  private cloudWatchClient: CloudWatchClient;
  private firehoseClient: FirehoseClient;
  private deliveryStreamName = 'vanillameta-user-events';

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });
    this.firehoseClient = new FirehoseClient({ region: process.env.AWS_REGION });
  }

  async trackEvent(event: UserEvent): Promise<void> {
    // 이벤트 데이터 보강
    const enrichedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: event.sessionId || 'anonymous',
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
    };

    // Kinesis Firehose로 전송 (S3 저장)
    await this.sendToFirehose(enrichedEvent);

    // CloudWatch 메트릭 발행
    await this.publishMetric(event.eventName, event.properties);
  }

  private async sendToFirehose(event: any): Promise<void> {
    const record = {
      Data: Buffer.from(JSON.stringify(event) + '\n'),
    };

    try {
      await this.firehoseClient.send(new PutRecordCommand({
        DeliveryStreamName: this.deliveryStreamName,
        Record: record,
      }));
    } catch (error) {
      console.error('Failed to send event to Firehose:', error);
    }
  }

  private async publishMetric(
    eventName: string, 
    properties: Record<string, any>
  ): Promise<void> {
    const dimensions = Object.entries(properties)
      .filter(([_, value]) => typeof value === 'string')
      .slice(0, 10) // CloudWatch 제한
      .map(([Name, Value]) => ({ Name, Value: String(Value) }));

    await this.cloudWatchClient.send(new PutMetricDataCommand({
      Namespace: 'VanillaMeta/UserEvents',
      MetricData: [{
        MetricName: eventName,
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: dimensions,
      }],
    }));
  }
}

// 이벤트 타입 정의
export interface UserEvent {
  userId: string;
  sessionId?: string;
  eventName: string;
  properties: Record<string, any>;
  context?: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    page?: string;
  };
}
```

### 2. 이벤트 추적 미들웨어
```typescript
// backend-api/src/analytics/analytics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  constructor(private analyticsService: AnalyticsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Response 완료 시 이벤트 추적
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const userId = req.user?.id || 'anonymous';
      
      await this.analyticsService.trackEvent({
        userId,
        sessionId: req.session?.id,
        eventName: 'api_request',
        properties: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('user-agent'),
        },
      });
    });

    next();
  }
}
```

### 3. 프론트엔드 이벤트 추적
```typescript
// frontend-web/src/analytics/analytics.ts
import { v4 as uuidv4 } from 'uuid';

class Analytics {
  private sessionId: string;
  private userId: string | null = null;
  private apiEndpoint = process.env.REACT_APP_API_URL;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.setupPageTracking();
    this.setupErrorTracking();
  }

  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('sessionId');
    if (stored) return stored;
    
    const newId = uuidv4();
    sessionStorage.setItem('sessionId', newId);
    return newId;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  track(eventName: string, properties?: Record<string, any>): void {
    const event = {
      userId: this.userId || 'anonymous',
      sessionId: this.sessionId,
      eventName,
      properties: {
        ...properties,
        page: window.location.pathname,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      },
      context: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    };

    // 이벤트를 배치로 전송
    this.batchEvent(event);
  }

  private eventBatch: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  private batchEvent(event: any): void {
    this.eventBatch.push(event);
    
    if (this.eventBatch.length >= 10) {
      this.flushEvents();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushEvents(), 5000);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBatch.length === 0) return;

    const events = [...this.eventBatch];
    this.eventBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await fetch(`${this.apiEndpoint}/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to send analytics events:', error);
    }
  }

  private setupPageTracking(): void {
    // 페이지 뷰 추적
    this.track('page_viewed', {
      title: document.title,
      path: window.location.pathname,
    });

    // SPA 라우트 변경 추적
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.track('page_viewed', {
        title: document.title,
        path: window.location.pathname,
      });
    };
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.track('error_encountered', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('error_encountered', {
        type: 'unhandled_rejection',
        reason: event.reason,
      });
    });
  }

  // 특화된 추적 메서드들
  trackDashboardCreated(dashboardId: string, widgetCount: number): void {
    this.track('dashboard_created', {
      dashboardId,
      widgetCount,
    });
  }

  trackQueryExecuted(dataSourceType: string, queryTime: number, rowCount: number): void {
    this.track('query_executed', {
      dataSourceType,
      queryTime,
      rowCount,
      complexity: this.calculateQueryComplexity(queryTime, rowCount),
    });
  }

  trackFeatureUsed(featureName: string, context?: any): void {
    this.track('feature_used', {
      featureName,
      ...context,
    });
  }

  private calculateQueryComplexity(queryTime: number, rowCount: number): string {
    if (queryTime < 1000 && rowCount < 1000) return 'simple';
    if (queryTime < 5000 && rowCount < 10000) return 'moderate';
    return 'complex';
  }
}

export const analytics = new Analytics();
```

### 4. React 컴포넌트 통합
```tsx
// frontend-web/src/hooks/useAnalytics.tsx
import { useEffect } from 'react';
import { analytics } from '../analytics/analytics';

export function useAnalytics(componentName: string) {
  useEffect(() => {
    analytics.track('component_mounted', { componentName });
    
    return () => {
      analytics.track('component_unmounted', { componentName });
    };
  }, [componentName]);

  return {
    trackClick: (elementName: string, properties?: any) => {
      analytics.track('button_clicked', {
        component: componentName,
        element: elementName,
        ...properties,
      });
    },
    trackFormSubmit: (formName: string, properties?: any) => {
      analytics.track('form_submitted', {
        component: componentName,
        form: formName,
        ...properties,
      });
    },
    trackFeature: (featureName: string, properties?: any) => {
      analytics.track('feature_used', {
        component: componentName,
        feature: featureName,
        ...properties,
      });
    },
  };
}

// 사용 예시
export function DashboardCreator() {
  const { trackClick, trackFormSubmit } = useAnalytics('DashboardCreator');

  const handleCreate = async (data: any) => {
    trackFormSubmit('dashboard_form', {
      widgetCount: data.widgets.length,
      hasSharing: data.isShared,
    });

    // 대시보드 생성 로직...
  };

  return (
    <form onSubmit={handleCreate}>
      {/* 폼 내용 */}
      <button 
        type="submit"
        onClick={() => trackClick('create_dashboard_button')}
      >
        대시보드 생성
      </button>
    </form>
  );
}
```

### 5. 분석 대시보드 구성
```typescript
// backend-api/src/analytics/analytics-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { QueryService } from '../query/query.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(private queryService: QueryService) {}

  async getUserEngagementMetrics(startDate: Date, endDate: Date) {
    const query = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT userId) as daily_active_users,
        COUNT(DISTINCT sessionId) as sessions,
        AVG(session_duration) as avg_session_duration,
        COUNT(*) / COUNT(DISTINCT sessionId) as pages_per_session
      FROM user_events
      WHERE timestamp BETWEEN ? AND ?
        AND eventName = 'page_viewed'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    return this.queryService.executeQuery(query, [startDate, endDate]);
  }

  async getFeatureAdoptionMetrics() {
    const query = `
      SELECT 
        eventName,
        COUNT(DISTINCT userId) as unique_users,
        COUNT(*) as total_uses,
        AVG(CASE WHEN properties->>'success' = 'true' THEN 1 ELSE 0 END) as success_rate
      FROM user_events
      WHERE eventName IN (
        'dashboard_created', 
        'chart_created', 
        'datasource_connected',
        'query_executed'
      )
      GROUP BY eventName
    `;

    return this.queryService.executeQuery(query);
  }

  async getUserJourneyFunnel() {
    const query = `
      WITH user_journey AS (
        SELECT 
          userId,
          MIN(CASE WHEN eventName = 'user_signup' THEN timestamp END) as signup_time,
          MIN(CASE WHEN eventName = 'datasource_connected' THEN timestamp END) as first_connection,
          MIN(CASE WHEN eventName = 'dashboard_created' THEN timestamp END) as first_dashboard,
          MIN(CASE WHEN eventName = 'dashboard_shared' THEN timestamp END) as first_share
        FROM user_events
        GROUP BY userId
      )
      SELECT 
        COUNT(*) as total_users,
        COUNT(first_connection) as connected_datasource,
        COUNT(first_dashboard) as created_dashboard,
        COUNT(first_share) as shared_dashboard,
        AVG(EXTRACT(EPOCH FROM (first_dashboard - signup_time))/3600) as avg_hours_to_first_dashboard
      FROM user_journey
    `;

    return this.queryService.executeQuery(query);
  }

  async getErrorAnalytics(timeWindow: string = '24h') {
    const query = `
      SELECT 
        properties->>'message' as error_message,
        properties->>'source' as error_source,
        COUNT(*) as occurrences,
        COUNT(DISTINCT userId) as affected_users,
        MAX(timestamp) as last_occurrence
      FROM user_events
      WHERE eventName = 'error_encountered'
        AND timestamp > NOW() - INTERVAL ?
      GROUP BY error_message, error_source
      ORDER BY occurrences DESC
      LIMIT 20
    `;

    return this.queryService.executeQuery(query, [timeWindow]);
  }
}
```

### 6. 실시간 분석 웹소켓
```typescript
// backend-api/src/analytics/realtime-analytics.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Interval } from '@nestjs/schedule';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
  },
})
export class RealtimeAnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeUsers = new Set<string>();
  private recentEvents: any[] = [];

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    this.activeUsers.add(userId);
    this.broadcastActiveUsers();
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    this.activeUsers.delete(userId);
    this.broadcastActiveUsers();
  }

  @Interval(5000) // 5초마다 업데이트
  async broadcastRealtimeMetrics() {
    const metrics = {
      activeUsers: this.activeUsers.size,
      recentEvents: this.recentEvents.slice(-10),
      timestamp: new Date().toISOString(),
    };

    this.server.emit('realtime-metrics', metrics);
  }

  private broadcastActiveUsers() {
    this.server.emit('active-users', {
      count: this.activeUsers.size,
      userIds: Array.from(this.activeUsers),
    });
  }

  addEvent(event: any) {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents = this.recentEvents.slice(-50);
    }
    
    this.server.emit('new-event', event);
  }
}
```

## 검증 항목

### 이벤트 추적 검증
- [ ] 모든 정의된 이벤트가 정상적으로 추적됨
- [ ] 이벤트 데이터가 S3에 저장됨
- [ ] 실시간 메트릭이 CloudWatch에 표시됨
- [ ] 배치 전송이 효율적으로 작동함

### 분석 기능 검증
- [ ] 사용자 여정 분석이 정확함
- [ ] 기능 채택률이 올바르게 계산됨
- [ ] 오류 분석이 문제 해결에 도움됨
- [ ] 실시간 대시보드가 정상 작동함

### 성능 검증
- [ ] 이벤트 추적이 앱 성능에 영향 없음
- [ ] 분석 쿼리 응답 시간 < 2초
- [ ] 대용량 이벤트 처리 가능

## 산출물
1. 이벤트 추적 라이브러리 (백엔드/프론트엔드)
2. 사용자 행동 분석 대시보드
3. 이벤트 카탈로그 문서
4. 분석 인사이트 리포트 템플릿
5. 실시간 모니터링 대시보드

## 참고 자료
- [AWS Kinesis Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html)
- [Google Analytics 이벤트 추적](https://developers.google.com/analytics/devguides/collection/gtagjs/events)
- [Mixpanel 구현 가이드](https://developer.mixpanel.com/docs/javascript)