# VanillaMeta 프론트엔드 Analytics 구현 가이드

## 1. 개요

이 문서는 VanillaMeta 프론트엔드 애플리케이션에서 사용자 행동 분석을 구현하는 방법을 설명합니다.

## 2. 초기 설정

### 2.1 환경 변수 설정

`.env` 파일에 다음 변수들을 추가합니다:

```bash
# Google Analytics (선택사항)
REACT_APP_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Analytics 설정
REACT_APP_ANALYTICS_ENABLED=true
REACT_APP_ANALYTICS_ENDPOINT=/api/v1/analytics/events
REACT_APP_ANALYTICS_SAMPLING_RATE=1.0
REACT_APP_CLOUDWATCH_ENABLED=true
```

### 2.2 App.tsx에서 초기화

```typescript
import { useEffect } from 'react';
import { initializeGA } from './utils/analytics';
import { PrivacyConsent } from './components/PrivacyConsent/PrivacyConsent';
import { useUserTracking } from './hooks/useUserTracking';

function App() {
  const tracking = useUserTracking();

  useEffect(() => {
    // Google Analytics 초기화
    if (process.env.REACT_APP_GA_MEASUREMENT_ID) {
      initializeGA(process.env.REACT_APP_GA_MEASUREMENT_ID);
    }
  }, []);

  return (
    <>
      {/* 개인정보 동의 컴포넌트 */}
      <PrivacyConsent />
      
      {/* 앱 컨텐츠 */}
      <Router>
        {/* ... */}
      </Router>
    </>
  );
}
```

## 3. 주요 컴포넌트별 구현

### 3.1 대시보드 컴포넌트

```typescript
// pages/Dashboard/DashboardCreate.tsx
import { useUserTracking } from '../../hooks/useUserTracking';

export const DashboardCreate: React.FC = () => {
  const tracking = useUserTracking();
  
  const handleCreateDashboard = async (dashboardData: DashboardData) => {
    try {
      const response = await createDashboard(dashboardData);
      
      // 대시보드 생성 추적
      tracking.trackDashboardCreated(
        response.data.id,
        dashboardData.templateId,
        dashboardData.widgets?.length || 0
      );
      
      // 성능 메트릭 추적
      tracking.trackPerformance('dashboard_creation_time', Date.now() - startTime);
      
    } catch (error) {
      tracking.trackError(error as Error, 'DashboardCreate');
    }
  };
  
  return (
    // ... 컴포넌트 JSX
  );
};
```

### 3.2 위젯 컴포넌트

```typescript
// components/Widget/WidgetWrapper.tsx
import { useUserTracking } from '../../hooks/useUserTracking';
import { useEffect, useRef } from 'react';

export const WidgetWrapper: React.FC<WidgetProps> = ({ widget, onEdit, onDelete }) => {
  const tracking = useUserTracking();
  const renderStartTime = useRef(Date.now());
  
  useEffect(() => {
    // 차트 렌더링 시간 추적
    const renderTime = Date.now() - renderStartTime.current;
    tracking.trackChartRenderTime(
      widget.chartType,
      renderTime,
      widget.dataPoints || 0
    );
  }, [widget.chartType]);
  
  const handleInteraction = (interactionType: string) => {
    tracking.trackWidgetInteraction(
      widget.id,
      widget.type,
      interactionType
    );
  };
  
  const handleEdit = () => {
    tracking.trackWidgetEdited(widget.id, widget.type);
    onEdit(widget);
  };
  
  const handleDelete = () => {
    tracking.trackWidgetDeleted(widget.id, widget.type);
    onDelete(widget.id);
  };
  
  return (
    <div 
      onClick={() => handleInteraction('click')}
      onMouseEnter={() => handleInteraction('hover')}
    >
      {/* 위젯 컨텐츠 */}
    </div>
  );
};
```

### 3.3 데이터 연결 컴포넌트

```typescript
// pages/Data/DatabaseConnect.tsx
export const DatabaseConnect: React.FC = () => {
  const tracking = useUserTracking();
  
  const handleConnect = async (connectionData: ConnectionData) => {
    const startTime = Date.now();
    
    try {
      await connectDatabase(connectionData);
      
      tracking.trackDatabaseConnected(connectionData.type, true);
      tracking.trackPerformance(
        'database_connection_time',
        Date.now() - startTime
      );
      
    } catch (error) {
      tracking.trackDatabaseConnected(connectionData.type, false);
      tracking.trackError(error as Error, 'DatabaseConnect');
    }
  };
  
  return (
    // ... 컴포넌트 JSX
  );
};
```

### 3.4 쿼리 실행 컴포넌트

```typescript
// components/QueryEditor/QueryEditor.tsx
export const QueryEditor: React.FC = () => {
  const tracking = useUserTracking();
  
  const executeQuery = async (query: string) => {
    const startTime = Date.now();
    
    try {
      const result = await runQuery(query);
      const duration = Date.now() - startTime;
      
      tracking.trackQueryExecuted(
        result.datasetId,
        duration,
        result.rowCount,
        true
      );
      
      // 느린 쿼리 추적
      if (duration > 5000) {
        tracking.trackCustomEvent(
          'slow_query_detected',
          'Performance',
          { duration, rowCount: result.rowCount }
        );
      }
      
    } catch (error) {
      tracking.trackQueryExecuted(
        'unknown',
        Date.now() - startTime,
        0,
        false
      );
    }
  };
  
  return (
    // ... 컴포넌트 JSX
  );
};
```

### 3.5 사용자 인증 컴포넌트

```typescript
// pages/Login/Login.tsx
export const Login: React.FC = () => {
  const tracking = useUserTracking();
  
  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      const user = await loginUser(credentials);
      
      tracking.trackUserLogin(credentials.method || 'email');
      tracking.setUserId(user.id);
      
    } catch (error) {
      tracking.trackCustomEvent(
        'login_failed',
        'User',
        { reason: error.message }
      );
    }
  };
  
  return (
    // ... 컴포넌트 JSX
  );
};

// pages/Register/Register.tsx
export const Register: React.FC = () => {
  const tracking = useUserTracking();
  
  const handleRegister = async (userData: RegisterData) => {
    try {
      const user = await registerUser(userData);
      
      tracking.trackUserRegistered(userData.registrationMethod || 'email');
      tracking.setUserId(user.id);
      
      // 온보딩 시작 추적
      tracking.trackOnboardingProgress('welcome', 'started');
      
    } catch (error) {
      tracking.trackError(error as Error, 'Register');
    }
  };
  
  return (
    // ... 컴포넌트 JSX
  );
};
```

## 4. 성능 추적

### 4.1 Web Vitals 추적

```typescript
// index.tsx
import { reportWebVitals } from './reportWebVitals';
import { analyticsService } from './utils/enhanced-analytics';

reportWebVitals((metric) => {
  // Core Web Vitals를 Analytics로 전송
  analyticsService.trackPerformance(
    metric.name,
    metric.value,
    metric.name === 'CLS' ? 'score' : 'ms'
  );
});
```

### 4.2 컴포넌트 렌더링 성능

```typescript
// hooks/useRenderTracking.ts
import { useEffect, useRef } from 'react';
import { useUserTracking } from './useUserTracking';

export const useRenderTracking = (componentName: string) => {
  const tracking = useUserTracking();
  const renderCount = useRef(0);
  const renderStartTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current++;
    const renderTime = Date.now() - renderStartTime.current;
    
    // 과도한 리렌더링 감지
    if (renderCount.current > 10) {
      tracking.trackCustomEvent(
        'excessive_rerender',
        'Performance',
        {
          component: componentName,
          count: renderCount.current,
          time: renderTime
        }
      );
    }
    
    renderStartTime.current = Date.now();
  });
};
```

## 5. 에러 추적

### 5.1 Error Boundary 통합

```typescript
// components/ErrorBoundary/AnalyticsErrorBoundary.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { useUserTracking } from '../../hooks/useUserTracking';

export const AnalyticsErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tracking = useUserTracking();
  
  const handleError = (error: Error, errorInfo: { componentStack: string }) => {
    tracking.trackError(error, errorInfo.componentStack);
    
    // Critical 에러는 즉시 전송
    if (error.message.includes('Critical')) {
      analyticsService.flushEvents(true);
    }
  };
  
  return (
    <ErrorBoundary
      onError={handleError}
      fallback={<ErrorFallback />}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### 5.2 API 에러 추적

```typescript
// utils/api.ts
import axios from 'axios';
import { analyticsService } from './enhanced-analytics';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // API 에러 추적
    analyticsService.track(
      EventAction.ERROR_OCCURRED,
      EventCategory.ERROR,
      {
        errorType: 'API_ERROR',
        errorMessage: error.message,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
      }
    );
    
    return Promise.reject(error);
  }
);
```

## 6. 사용자 행동 패턴 추적

### 6.1 사용자 세션 추적

```typescript
// contexts/SessionContext.tsx
export const SessionProvider: React.FC = ({ children }) => {
  const tracking = useUserTracking();
  const sessionStartTime = useRef(Date.now());
  
  useEffect(() => {
    // 세션 시작
    tracking.trackCustomEvent('session_start', 'User', {
      referrer: document.referrer,
      landingPage: window.location.pathname,
    });
    
    // 세션 종료 시
    return () => {
      const sessionDuration = Date.now() - sessionStartTime.current;
      tracking.trackCustomEvent('session_end', 'User', {
        duration: Math.round(sessionDuration / 1000), // 초 단위
      });
    };
  }, []);
  
  return <>{children}</>;
};
```

### 6.2 사용자 여정 추적

```typescript
// hooks/useUserJourney.ts
export const useUserJourney = () => {
  const tracking = useUserTracking();
  const journey = useRef<string[]>([]);
  
  const trackStep = (step: string) => {
    journey.current.push(step);
    
    // 주요 전환 경로 추적
    if (journey.current.includes('register') && step === 'dashboard_created') {
      tracking.trackCustomEvent('conversion_complete', 'User', {
        path: journey.current.join(' → '),
        steps: journey.current.length,
      });
    }
  };
  
  return { trackStep };
};
```

## 7. 데이터 프라이버시

### 7.1 PII 필터링

```typescript
// utils/privacy.ts
export const sanitizePII = (data: any): any => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /\d{2,4}-\d{3,4}-\d{4}/g;
  
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(emailRegex, '***@***.***')
        .replace(phoneRegex, '***-****-****');
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        // 민감한 필드 제외
        if (!['password', 'token', 'secret'].includes(key.toLowerCase())) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };
  
  return sanitize(data);
};
```

### 7.2 동의 관리

```typescript
// components/ConsentManager/ConsentManager.tsx
export const ConsentManager: React.FC = () => {
  const [consent, setConsent] = useState<ConsentState>(() => {
    return JSON.parse(localStorage.getItem('privacy_consent') || '{}');
  });
  
  const updateConsent = (type: keyof ConsentState, value: boolean) => {
    const newConsent = { ...consent, [type]: value };
    setConsent(newConsent);
    localStorage.setItem('privacy_consent', JSON.stringify(newConsent));
    
    // Analytics 동의 업데이트
    if (type === 'analytics') {
      analyticsService.updateConsent(value);
    }
  };
  
  return (
    // ... 동의 관리 UI
  );
};
```

## 8. 디버깅 및 테스트

### 8.1 개발 환경 디버깅

```typescript
// Chrome DevTools Console에서 실행
window.__ANALYTICS_DEBUG__ = true;

// 이벤트 로깅 확인
analyticsService.on('event', (event) => {
  console.log('Analytics Event:', event);
});
```

### 8.2 테스트 코드

```typescript
// __tests__/analytics.test.ts
import { renderHook } from '@testing-library/react-hooks';
import { useUserTracking } from '../hooks/useUserTracking';

describe('Analytics Tracking', () => {
  it('should track dashboard creation', () => {
    const { result } = renderHook(() => useUserTracking());
    
    const trackSpy = jest.spyOn(analyticsService, 'track');
    
    result.current.trackDashboardCreated('dashboard-1', 'template-1', 5);
    
    expect(trackSpy).toHaveBeenCalledWith(
      EventAction.DASHBOARD_CREATED,
      EventCategory.DASHBOARD,
      expect.objectContaining({
        dashboardId: 'dashboard-1',
        templateUsed: 'template-1',
        widgetCount: 5,
      })
    );
  });
});
```

## 9. 모범 사례

### 9.1 이벤트 명명 규칙

- 동작_대상 형식 사용: `dashboard_created`, `widget_deleted`
- 소문자와 언더스코어 사용
- 명확하고 일관된 이름 사용

### 9.2 성능 고려사항

- 배치 처리로 네트워크 요청 최소화
- 중요하지 않은 이벤트는 샘플링
- 대용량 데이터는 압축하여 전송

### 9.3 개인정보 보호

- PII는 항상 필터링
- 민감한 데이터는 해싱
- 사용자 동의 없이 추적 금지

## 10. 트러블슈팅

### 10.1 이벤트가 전송되지 않음

1. 브라우저 콘솔에서 네트워크 에러 확인
2. 동의 상태 확인: `localStorage.getItem('analytics_consent')`
3. 환경 변수 확인: `REACT_APP_ANALYTICS_ENABLED`

### 10.2 성능 저하

1. 이벤트 큐 크기 확인
2. 샘플링 비율 조정
3. 배치 크기 및 간격 조정

### 10.3 데이터 불일치

1. 시간대 설정 확인
2. 중복 이벤트 제거 로직 확인
3. 세션 ID 일관성 확인