// 통합 Analytics 모듈

export * from './eventTypes';
export * from './eventTracker';
export * from './trackingHelpers';

import { eventTracker } from './eventTracker';
import { EventAction, EventCategory } from './eventTypes';

// 기존 analytics.ts와의 하위 호환성을 위한 래퍼 함수들
export const initializeGA = (measurementId: string) => {
  if (!measurementId || typeof window === 'undefined') {
    console.warn('Google Analytics measurement ID not provided or not in browser environment');
    return;
  }

  // gtag 스크립트 동적 로드
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // gtag 초기화
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', {
      send_page_view: false,
      anonymize_ip: true
    });
  `;
  document.head.appendChild(script2);

  console.log('Google Analytics initialized with ID:', measurementId);
};

// 페이지뷰 추적
export const trackPageView = (url: string) => {
  // Google Analytics
  if (window.gtag) {
    window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID!, {
      page_path: url,
    });
  }

  // 내부 이벤트 추적
  eventTracker.trackPageView(url);
};

// 이벤트 추적
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }

  // 내부 이벤트 추적 시스템으로 매핑
  const mappedAction = mapToEventAction(action);
  const mappedCategory = mapToEventCategory(category);

  if (mappedAction && mappedCategory) {
    eventTracker.track(mappedAction, mappedCategory, undefined, label, value);
  }
};

// 사용자 타이밍 추적
export const trackTiming = (name: string, value: number, category = 'performance', label?: string) => {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', 'timing_complete', {
      name,
      value: Math.round(value),
      event_category: category,
      event_label: label,
    });
  }

  // 내부 성능 추적
  eventTracker.trackPerformance({
    name,
    value,
    category,
    tags: label ? { label } : undefined,
  });
};

// 예외 추적
export const trackException = (description: string, fatal = false) => {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description,
      fatal,
    });
  }

  // 내부 에러 추적
  const error = new Error(description);
  eventTracker.trackError(error, fatal);
};

// 커스텀 차원 설정
export const setCustomDimension = (dimensionName: string, value: string) => {
  if (window.gtag) {
    window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID!, {
      custom_map: {
        [dimensionName]: value,
      },
    });
  }
};

// 성능 메트릭 배치 전송
export const sendPerformanceMetrics = (
  metrics: Array<{
    name: string;
    value: number;
    category?: string;
  }>,
) => {
  // Google Analytics
  if (window.gtag && metrics.length > 0) {
    metrics.forEach(metric => {
      window.gtag('event', 'performance_metric', {
        metric_name: metric.name,
        value: Math.round(metric.value),
        event_category: metric.category || 'performance',
      });
    });
  }

  // 내부 성능 추적
  metrics.forEach(metric => {
    eventTracker.trackPerformance(metric);
  });
};

// 액션 매핑 헬퍼
function mapToEventAction(action: string): EventAction | null {
  const actionMap: Record<string, EventAction> = {
    dashboard_create: EventAction.DASHBOARD_CREATED,
    dashboard_view: EventAction.DASHBOARD_VIEWED,
    widget_create: EventAction.WIDGET_CREATED,
    user_login: EventAction.USER_LOGIN,
    // 더 많은 매핑 추가 가능
  };

  return actionMap[action] || null;
}

// 카테고리 매핑 헬퍼
function mapToEventCategory(category: string): EventCategory | null {
  const categoryMap: Record<string, EventCategory> = {
    dashboard: EventCategory.DASHBOARD,
    widget: EventCategory.WIDGET,
    user: EventCategory.USER,
    database: EventCategory.DATABASE,
    // 더 많은 매핑 추가 가능
  };

  return categoryMap[category.toLowerCase()] || null;
}

// 타입 선언
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// 기본 export
export default eventTracker;
