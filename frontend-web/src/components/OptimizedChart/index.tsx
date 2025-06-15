import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useChart } from '@/contexts/ChartContext';
import { debounce } from 'lodash';
import * as echarts from 'echarts/core';

interface OptimizedChartProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  onChartReady?: (instance: echarts.ECharts) => void;
  onEvents?: { [eventName: string]: (params: any) => void };
  renderer?: 'canvas' | 'svg';
  enableDataSampling?: boolean;
  maxDataPoints?: number;
  containerId?: string;
}

/**
 * 최적화된 ECharts 컴포넌트
 * 
 * 주요 최적화 기능:
 * - 인스턴스 풀링으로 메모리 효율성 개선
 * - 데이터 샘플링으로 대량 데이터 처리 최적화
 * - 디바운싱된 리사이즈 처리
 * - 스마트한 옵션 업데이트 (변경 감지)
 * - Canvas 렌더러 우선 사용
 * - 자동 dispose 및 정리
 */
const OptimizedChart: React.FC<OptimizedChartProps> = ({
  option,
  style = { width: '100%', height: '100%' },
  className,
  notMerge = false,
  lazyUpdate = false,
  onChartReady,
  onEvents = {},
  renderer = 'canvas',
  enableDataSampling = true,
  maxDataPoints = 10000,
  containerId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastOptionRef = useRef<echarts.EChartsOption>({});
  
  const {
    getChartInstance,
    releaseChartInstance,
    updateChartOptions,
    resizeChart,
    disposeChart,
  } = useChart();

  // 고유 ID 생성
  const chartId = useMemo(() => {
    return containerId || `chart-${Math.random().toString(36).substr(2, 9)}`;
  }, [containerId]);

  // 데이터 샘플링 함수
  const sampleData = useCallback((data: any[], maxPoints: number): any[] => {
    if (!data || data.length <= maxPoints) return data;

    const step = Math.ceil(data.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    // 마지막 데이터 포인트는 항상 포함
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    
    return sampled;
  }, []);

  // 옵션 최적화 (데이터 샘플링 적용)
  const optimizedOption = useMemo(() => {
    if (!enableDataSampling) return option;

    const optimized = { ...option };
    
    if (optimized.series && Array.isArray(optimized.series)) {
      optimized.series = optimized.series.map(series => {
        if (series.data && Array.isArray(series.data) && series.data.length > maxDataPoints) {
          return {
            ...series,
            data: sampleData(series.data, maxDataPoints),
            sampling: 'average', // ECharts 내장 샘플링도 활용
          };
        }
        return series;
      });
    }

    return optimized;
  }, [option, enableDataSampling, maxDataPoints, sampleData]);

  // 디바운싱된 리사이즈 핸들러
  const debouncedResize = useMemo(
    () => debounce(() => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        resizeChart(chartId);
      }
    }, 100),
    [chartId, resizeChart]
  );

  // 옵션 변경 감지 및 업데이트
  const hasOptionChanged = useMemo(() => {
    return JSON.stringify(optimizedOption) !== JSON.stringify(lastOptionRef.current);
  }, [optimizedOption]);

  // 차트 인스턴스 초기화
  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.id = chartId;
    
    const instance = getChartInstance(chartId, { renderer });
    if (!instance) return;

    chartInstanceRef.current = instance;

    // 이벤트 리스너 등록
    Object.entries(onEvents).forEach(([eventName, handler]) => {
      instance.on(eventName, handler);
    });

    // 초기 옵션 설정
    updateChartOptions(chartId, optimizedOption, true, lazyUpdate);
    lastOptionRef.current = optimizedOption;

    // onChartReady 콜백 실행
    onChartReady?.(instance);

    console.log(`[OptimizedChart] Initialized chart: ${chartId}`);
  }, [chartId, getChartInstance, renderer, onEvents, updateChartOptions, optimizedOption, lazyUpdate, onChartReady]);

  // ResizeObserver 설정
  useEffect(() => {
    if (!containerRef.current) return;

    if ('ResizeObserver' in window) {
      resizeObserverRef.current = new ResizeObserver(debouncedResize);
      resizeObserverRef.current.observe(containerRef.current);
    } else {
      // ResizeObserver 미지원 브라우저 대응
      window.addEventListener('resize', debouncedResize);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', debouncedResize);
      debouncedResize.cancel();
    };
  }, [debouncedResize]);

  // 차트 초기화
  useEffect(() => {
    initChart();
    
    return () => {
      releaseChartInstance(chartId);
    };
  }, [initChart, releaseChartInstance, chartId]);

  // 옵션 업데이트
  useEffect(() => {
    if (chartInstanceRef.current && hasOptionChanged) {
      updateChartOptions(chartId, optimizedOption, notMerge, lazyUpdate);
      lastOptionRef.current = optimizedOption;
    }
  }, [optimizedOption, hasOptionChanged, updateChartOptions, chartId, notMerge, lazyUpdate]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 개발 환경에서 StrictMode로 인한 중복 dispose 방지
      const timeoutId = setTimeout(() => {
        disposeChart(chartId);
      }, 100);

      return () => clearTimeout(timeoutId);
    };
  }, [disposeChart, chartId]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        // 하드웨어 가속 활성화
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
};

export default OptimizedChart;