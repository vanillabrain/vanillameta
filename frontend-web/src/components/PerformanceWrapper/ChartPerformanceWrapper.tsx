import React, { useEffect, useRef, ComponentType } from 'react';
import { usePerformance } from '@/contexts/PerformanceContext';

interface ChartPerformanceWrapperProps {
  chartType: string;
  widgetId?: string;
  dataSize?: number;
}

// HOC for wrapping chart components with performance monitoring
export function withChartPerformance<P extends object>(
  WrappedComponent: ComponentType<P>,
  chartType: string
) {
  return React.forwardRef<any, P & ChartPerformanceWrapperProps>((props, ref) => {
    const { widgetId, dataSize, ...restProps } = props as any;
    const { markStart, markEnd } = usePerformance();
    const renderStartTime = useRef<number>(performance.now());
    const isFirstRender = useRef(true);

    // 컴포넌트 마운트 시작
    useEffect(() => {
      const metadata = {
        chartType,
        widgetId: widgetId || 'unknown',
        dataSize: dataSize || 0,
        isFirstRender: isFirstRender.current,
      };

      // 렌더링 시작 마크
      markStart(`chart-render-${chartType}`, metadata);

      // 다음 프레임에서 렌더링 완료 체크
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          markEnd(`chart-render-${chartType}`);
          
          // 첫 렌더링 시간 기록
          if (isFirstRender.current) {
            const firstRenderTime = performance.now() - renderStartTime.current;
            console.log(`📊 ${chartType} first render time: ${firstRenderTime.toFixed(2)}ms`);
            
            // 느린 차트 렌더링 경고 (1초 이상)
            if (firstRenderTime > 1000) {
              console.warn(`⚠️ Slow chart rendering detected: ${chartType} took ${firstRenderTime.toFixed(2)}ms`);
            }
            
            isFirstRender.current = false;
          }
        });
      });

      return () => {
        // 컴포넌트 언마운트 시에도 측정
        markStart(`chart-unmount-${chartType}`, { chartType });
        markEnd(`chart-unmount-${chartType}`);
      };
    }, [chartType, widgetId, dataSize, markStart, markEnd]);

    // 데이터 업데이트 시 재렌더링 시간 측정
    useEffect(() => {
      if (!isFirstRender.current && dataSize !== undefined) {
        markStart(`chart-update-${chartType}`, {
          chartType,
          dataSize,
          widgetId: widgetId || 'unknown',
        });

        requestAnimationFrame(() => {
          markEnd(`chart-update-${chartType}`);
        });
      }
    }, [dataSize, chartType, widgetId, markStart, markEnd]);

    return <WrappedComponent ref={ref} {...(restProps as P)} />;
  });
}

// 차트별 성능 측정을 위한 래퍼 컴포넌트
interface ChartPerformanceWrapperComponentProps {
  children: React.ReactNode;
  chartType: string;
  widgetId?: string;
  dataSize?: number;
}

export const ChartPerformanceWrapper: React.FC<ChartPerformanceWrapperComponentProps> = ({
  children,
  chartType,
  widgetId,
  dataSize,
}) => {
  const { markStart, markEnd } = usePerformance();

  useEffect(() => {
    const metadata = {
      chartType,
      widgetId: widgetId || 'unknown',
      dataSize: dataSize || 0,
    };

    markStart(`chart-wrapper-${chartType}`, metadata);

    // Intersection Observer로 차트가 뷰포트에 나타났을 때 측정
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            markEnd(`chart-wrapper-${chartType}`);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    // 차트 컨테이너 찾기
    const chartContainer = document.getElementById(`chart-${widgetId}`);
    if (chartContainer) {
      observer.observe(chartContainer);
    }

    return () => {
      observer.disconnect();
    };
  }, [chartType, widgetId, dataSize, markStart, markEnd]);

  return <>{children}</>;
};