/**
 * React Hook for User Behavior Tracking
 * 컴포넌트에서 쉽게 사용할 수 있는 사용자 행동 추적 훅
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService, EventAction, EventCategory, useAnalytics } from '../utils/enhanced-analytics';
import { useAuth } from '../contexts/AuthContext';

interface TrackingOptions {
  trackPageViews?: boolean;
  trackInteractions?: boolean;
  trackPerformance?: boolean;
  trackErrors?: boolean;
}

interface InteractionTrackingConfig {
  clicks?: boolean;
  scrollDepth?: boolean;
  timeOnPage?: boolean;
  formInteractions?: boolean;
}

export const useUserTracking = (options: TrackingOptions = {}) => {
  const { trackPageViews = true, trackInteractions = true, trackPerformance = true, trackErrors = true } = options;

  const location = useLocation();
  const analytics = useAnalytics();
  const { userState } = useAuth();
  const pageLoadTime = useRef<number>(Date.now());
  const scrollDepthRef = useRef<number>(0);
  const interactionCountRef = useRef<number>(0);

  // 사용자 ID 설정
  useEffect(() => {
    if (userState.userId) {
      analytics.setUserId(userState.userId);
    }
  }, [userState.userId, analytics]);

  // 페이지뷰 추적
  useEffect(() => {
    if (trackPageViews) {
      analytics.trackPageView(location.pathname, document.title);
      pageLoadTime.current = Date.now();
      scrollDepthRef.current = 0;
      interactionCountRef.current = 0;
    }
  }, [location, trackPageViews, analytics]);

  // 페이지 성능 추적
  useEffect(() => {
    if (trackPerformance && 'performance' in window) {
      // 페이지 로드 성능
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (perfData) {
          analytics.trackPerformance('page_load_time', perfData.loadEventEnd - perfData.fetchStart);
          analytics.trackPerformance('dom_content_loaded', perfData.domContentLoadedEventEnd - perfData.fetchStart);
          analytics.trackPerformance('first_paint', perfData.responseEnd - perfData.fetchStart);
        }
      });

      // LCP (Largest Contentful Paint) 추적
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        analytics.trackPerformance('largest_contentful_paint', lastEntry.startTime);
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP를 지원하지 않는 브라우저
      }

      return () => {
        observer.disconnect();
      };
    }
  }, [trackPerformance, analytics]);

  // 스크롤 깊이 추적
  useEffect(() => {
    if (trackInteractions) {
      const handleScroll = () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;
        const scrollPercentage = Math.round((scrolled / scrollHeight) * 100);

        // 25% 단위로 추적
        const milestones = [25, 50, 75, 100];
        for (const milestone of milestones) {
          if (scrollPercentage >= milestone && scrollDepthRef.current < milestone) {
            scrollDepthRef.current = milestone;
            analytics.track(EventAction.DASHBOARD_VIEWED, EventCategory.USER, {
              scrollDepth: milestone,
              url: location.pathname,
            });
          }
        }
      };

      const throttledScroll = throttle(handleScroll, 1000);
      window.addEventListener('scroll', throttledScroll);

      return () => {
        window.removeEventListener('scroll', throttledScroll);
      };
    }
  }, [trackInteractions, location.pathname, analytics]);

  // 페이지 체류 시간 추적
  useEffect(() => {
    if (trackInteractions) {
      const handleUnload = () => {
        const timeOnPage = Date.now() - pageLoadTime.current;
        analytics.track(EventAction.DASHBOARD_VIEWED, EventCategory.USER, {
          timeOnPage: Math.round(timeOnPage / 1000), // 초 단위
          url: location.pathname,
          interactionCount: interactionCountRef.current,
        });
      };

      window.addEventListener('beforeunload', handleUnload);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          handleUnload();
        }
      });

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [trackInteractions, location.pathname, analytics]);

  // 에러 추적
  useEffect(() => {
    if (trackErrors) {
      const handleError = (event: ErrorEvent) => {
        analytics.trackError(new Error(event.message), event.filename);
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        analytics.trackError(new Error(event.reason?.message || 'Unhandled Promise Rejection'), 'Promise');
      };

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, [trackErrors, analytics]);

  // 대시보드 관련 추적 함수들
  const trackDashboardCreated = useCallback(
    (dashboardId: string, templateUsed?: string, widgetCount?: number) => {
      analytics.track(EventAction.DASHBOARD_CREATED, EventCategory.DASHBOARD, {
        dashboardId,
        templateUsed,
        widgetCount,
      });
    },
    [analytics],
  );

  const trackDashboardEdited = useCallback(
    (dashboardId: string, dashboardName?: string) => {
      analytics.track(EventAction.DASHBOARD_EDITED, EventCategory.DASHBOARD, {
        dashboardId,
        dashboardName,
      });
    },
    [analytics],
  );

  const trackDashboardShared = useCallback(
    (dashboardId: string, shareMethod: string) => {
      analytics.track(EventAction.DASHBOARD_SHARED, EventCategory.DASHBOARD, {
        dashboardId,
        shareMethod,
      });
    },
    [analytics],
  );

  // 위젯 관련 추적 함수들
  const trackWidgetCreated = useCallback(
    (widgetId: string, widgetType: string, chartType?: string) => {
      analytics.track(EventAction.WIDGET_CREATED, EventCategory.WIDGET, {
        widgetId,
        widgetType,
        chartType,
      });
    },
    [analytics],
  );

  const trackWidgetEdited = useCallback(
    (widgetId: string, widgetType: string) => {
      analytics.track(EventAction.WIDGET_EDITED, EventCategory.WIDGET, {
        widgetId,
        widgetType,
      });
    },
    [analytics],
  );

  const trackWidgetInteraction = useCallback(
    (widgetId: string, widgetType: string, interactionType: string) => {
      interactionCountRef.current += 1;
      analytics.track(EventAction.WIDGET_INTERACTED, EventCategory.WIDGET, {
        widgetId,
        widgetType,
        interactionType,
      });
    },
    [analytics],
  );

  // 데이터 관련 추적 함수들
  const trackDatabaseConnected = useCallback(
    (databaseType: string, success: boolean) => {
      analytics.track(EventAction.DATABASE_CONNECTED, EventCategory.DATA, {
        databaseType,
        success,
      });
    },
    [analytics],
  );

  const trackQueryExecuted = useCallback(
    (datasetId: string, queryDuration: number, rowCount: number, success: boolean) => {
      analytics.track(success ? EventAction.QUERY_EXECUTED : EventAction.QUERY_FAILED, EventCategory.DATA, {
        datasetId,
        queryDuration,
        rowCount,
      });

      // 쿼리 성능 메트릭
      analytics.trackPerformance('query_execution_time', queryDuration);
    },
    [analytics],
  );

  const trackDataExported = useCallback(
    (format: string, rowCount: number) => {
      analytics.track(EventAction.DATA_EXPORTED, EventCategory.DATA, {
        format,
        rowCount,
      });
    },
    [analytics],
  );

  // 사용자 여정 추적 함수들
  const trackUserRegistered = useCallback(
    (registrationMethod: string) => {
      analytics.track(EventAction.USER_REGISTERED, EventCategory.USER, {
        registrationMethod,
      });
    },
    [analytics],
  );

  const trackUserLogin = useCallback(
    (loginMethod: string) => {
      analytics.track(EventAction.USER_LOGIN, EventCategory.USER, {
        loginMethod,
      });
    },
    [analytics],
  );

  const trackOnboardingProgress = useCallback(
    (step: string, action: 'started' | 'completed' | 'skipped') => {
      const eventAction =
        action === 'started'
          ? EventAction.ONBOARDING_STARTED
          : action === 'completed'
          ? EventAction.ONBOARDING_COMPLETED
          : EventAction.ONBOARDING_SKIPPED;

      analytics.track(eventAction, EventCategory.USER, {
        onboardingStep: step,
      });
    },
    [analytics],
  );

  // 커스텀 이벤트 추적
  const trackCustomEvent = useCallback(
    (action: string, category: string, data?: any) => {
      analytics.track(action as EventAction, category as EventCategory, data);
    },
    [analytics],
  );

  // 차트 렌더링 성능 추적
  const trackChartRenderTime = useCallback(
    (chartType: string, renderTime: number, dataPoints: number) => {
      analytics.trackPerformance(`chart_render_${chartType}`, renderTime);
      analytics.track(EventAction.CHART_RENDER_TIME, EventCategory.PERFORMANCE, {
        chartType,
        renderTime,
        dataPoints,
      });
    },
    [analytics],
  );

  return {
    // 대시보드 추적
    trackDashboardCreated,
    trackDashboardEdited,
    trackDashboardShared,

    // 위젯 추적
    trackWidgetCreated,
    trackWidgetEdited,
    trackWidgetInteraction,

    // 데이터 추적
    trackDatabaseConnected,
    trackQueryExecuted,
    trackDataExported,

    // 사용자 추적
    trackUserRegistered,
    trackUserLogin,
    trackOnboardingProgress,

    // 성능 추적
    trackChartRenderTime,
    trackPerformance: analytics.trackPerformance,

    // 커스텀 추적
    trackCustomEvent,

    // 동의 관리
    updateConsent: analytics.updateConsent,
  };
};

// 유틸리티 함수: throttle
function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (!timeout) {
      timeout = setTimeout(() => {
        func(...lastArgs!);
        timeout = null;
      }, wait);
    }
  };
}
