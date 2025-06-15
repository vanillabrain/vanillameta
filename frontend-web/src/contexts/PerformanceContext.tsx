import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';

interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceContextType {
  markStart: (name: string, metadata?: Record<string, any>) => void;
  markEnd: (name: string) => void;
  measureDuration: (name: string, startMark: string, endMark: string) => number | null;
  getMetrics: () => PerformanceMark[];
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: ReactNode;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({ children }) => {
  const performanceMarks = useRef<Map<string, PerformanceMark>>(new Map());
  const metricsBuffer = useRef<PerformanceMark[]>([]);

  // Performance Observer 설정
  useEffect(() => {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver is not supported in this browser');
      return;
    }

    try {
      // Navigation timing 관찰
      const navigationObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log('Navigation Performance:', {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
              domInteractive: navEntry.domInteractive,
              domComplete: navEntry.domComplete,
            });
          }
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });

      // Resource timing 관찰 (리소스 로딩 성능)
      const resourceObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            // 주요 리소스 (JS, CSS) 로딩 시간 추적
            if (resourceEntry.name.includes('.js') || resourceEntry.name.includes('.css')) {
              const loadTime = resourceEntry.responseEnd - resourceEntry.startTime;
              if (loadTime > 1000) { // 1초 이상 걸린 리소스만 로깅
                console.warn(`Slow resource loading: ${resourceEntry.name} took ${loadTime.toFixed(2)}ms`);
              }
            }
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });

      // Long tasks 관찰 (50ms 이상의 작업)
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
          
          // 분석 도구로 전송
          if (window.gtag && process.env.NODE_ENV === 'production') {
            window.gtag('event', 'long_task', {
              value: Math.round(entry.duration),
              event_category: 'performance',
            });
          }
        }
      });
      
      // Long task observer는 일부 브라우저에서 지원하지 않을 수 있음
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      }

      // Layout shift 관찰
      const layoutShiftObserver = new PerformanceObserver((entryList) => {
        let totalShift = 0;
        for (const entry of entryList.getEntries()) {
          if ('value' in entry) {
            totalShift += (entry as any).value;
          }
        }
        if (totalShift > 0.1) { // 0.1 이상의 레이아웃 시프트 경고
          console.warn(`Layout shift detected: ${totalShift}`);
        }
      });
      
      if (PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      }

      // Cleanup
      return () => {
        navigationObserver.disconnect();
        resourceObserver.disconnect();
        longTaskObserver.disconnect();
        layoutShiftObserver.disconnect();
      };
    } catch (error) {
      console.error('Failed to setup PerformanceObserver:', error);
    }
  }, []);

  const markStart = (name: string, metadata?: Record<string, any>) => {
    const mark: PerformanceMark = {
      name,
      startTime: performance.now(),
      metadata,
    };
    performanceMarks.current.set(name, mark);
    
    // Native performance mark
    try {
      performance.mark(`${name}-start`);
    } catch (error) {
      console.warn(`Failed to create performance mark: ${name}`, error);
    }
  };

  const markEnd = (name: string) => {
    const startMark = performanceMarks.current.get(name);
    if (!startMark) {
      console.warn(`No start mark found for: ${name}`);
      return;
    }

    const duration = performance.now() - startMark.startTime;
    startMark.duration = duration;
    
    // Native performance mark and measure
    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch (error) {
      console.warn(`Failed to create performance measure: ${name}`, error);
    }

    // 버퍼에 추가
    metricsBuffer.current.push({ ...startMark });
    
    // 콘솔에 출력 (개발 환경)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`, startMark.metadata || '');
    }

    // 분석 도구로 전송 (프로덕션)
    if (window.gtag && process.env.NODE_ENV === 'production' && duration > 100) { // 100ms 이상만 전송
      window.gtag('event', 'custom_timing', {
        name,
        value: Math.round(duration),
        event_category: 'performance',
        ...startMark.metadata,
      });
    }

    // 메모리에서 제거
    performanceMarks.current.delete(name);
  };

  const measureDuration = (name: string, startMark: string, endMark: string): number | null => {
    try {
      performance.measure(name, startMark, endMark);
      const measures = performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        return measures[measures.length - 1].duration;
      }
    } catch (error) {
      console.warn(`Failed to measure duration: ${name}`, error);
    }
    return null;
  };

  const getMetrics = (): PerformanceMark[] => {
    return [...metricsBuffer.current];
  };

  const value: PerformanceContextType = {
    markStart,
    markEnd,
    measureDuration,
    getMetrics,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

// Custom hook for measuring component render time
export const useRenderTime = (componentName: string, metadata?: Record<string, any>) => {
  const { markStart, markEnd } = usePerformance();
  
  useEffect(() => {
    // 컴포넌트 마운트 시작
    markStart(`${componentName}-render`, metadata);
    
    // 컴포넌트 마운트 완료
    return () => {
      markEnd(`${componentName}-render`);
    };
  }, [componentName, markStart, markEnd, metadata]);
};

// 타입 선언
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}