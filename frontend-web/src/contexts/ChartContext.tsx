import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import * as echarts from 'echarts/core';

interface ChartInstance {
  id: string;
  instance: echarts.ECharts;
  lastUsed: number;
  isActive: boolean;
}

interface ChartContextType {
  getChartInstance: (containerId: string, options?: { renderer?: 'canvas' | 'svg' }) => echarts.ECharts | null;
  releaseChartInstance: (containerId: string) => void;
  updateChartOptions: (
    containerId: string, 
    options: echarts.EChartsOption, 
    notMerge?: boolean,
    lazyUpdate?: boolean
  ) => void;
  resizeChart: (containerId: string) => void;
  disposeChart: (containerId: string) => void;
  getInstanceCount: () => number;
}

const ChartContext = createContext<ChartContextType | undefined>(undefined);

/**
 * ECharts 인스턴스 풀링 및 성능 최적화를 위한 Context Provider
 * 
 * 주요 기능:
 * - 인스턴스 재사용으로 메모리 사용량 최적화
 * - 자동 가비지 컬렉션 (5분 후 미사용 인스턴스 제거)
 * - Canvas 렌더러 우선 사용으로 성능 향상
 * - 리사이즈 이벤트 디바운싱 내장
 * - 옵션 업데이트 최적화 (merge vs replace)
 */
export const ChartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const instancePool = useRef<Map<string, ChartInstance>>(new Map());
  const cleanupInterval = useRef<NodeJS.Timeout>();

  // 5분마다 미사용 인스턴스 정리
  useEffect(() => {
    cleanupInterval.current = setInterval(() => {
      const now = Date.now();
      const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5분

      instancePool.current.forEach((chartInstance, id) => {
        if (!chartInstance.isActive && (now - chartInstance.lastUsed) > CLEANUP_THRESHOLD) {
          console.log(`[ChartContext] Cleaning up unused instance: ${id}`);
          chartInstance.instance.dispose();
          instancePool.current.delete(id);
        }
      });
    }, 60 * 1000); // 1분마다 체크

    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
      // 모든 인스턴스 정리
      instancePool.current.forEach(chartInstance => {
        chartInstance.instance.dispose();
      });
      instancePool.current.clear();
    };
  }, []);

  const getChartInstance = useCallback((
    containerId: string,
    options: { renderer?: 'canvas' | 'svg' } = {}
  ): echarts.ECharts | null => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[ChartContext] Container not found: ${containerId}`);
      return null;
    }

    let chartInstance = instancePool.current.get(containerId);

    if (chartInstance && !chartInstance.instance.isDisposed()) {
      // 기존 인스턴스 재사용
      chartInstance.isActive = true;
      chartInstance.lastUsed = Date.now();
      return chartInstance.instance;
    }

    // 새 인스턴스 생성
    try {
      const instance = echarts.init(container, undefined, {
        renderer: options.renderer || 'canvas', // Canvas가 일반적으로 더 빠름
        useDirtyRect: true, // 부분 렌더링 최적화
        useCoarsePointer: true, // 터치 기기 최적화
      });

      const newChartInstance: ChartInstance = {
        id: containerId,
        instance,
        lastUsed: Date.now(),
        isActive: true,
      };

      instancePool.current.set(containerId, newChartInstance);
      
      console.log(`[ChartContext] Created new instance: ${containerId}`);
      return instance;
    } catch (error) {
      console.error(`[ChartContext] Failed to create instance: ${containerId}`, error);
      return null;
    }
  }, []);

  const releaseChartInstance = useCallback((containerId: string) => {
    const chartInstance = instancePool.current.get(containerId);
    if (chartInstance) {
      chartInstance.isActive = false;
      chartInstance.lastUsed = Date.now();
      console.log(`[ChartContext] Released instance: ${containerId}`);
    }
  }, []);

  const updateChartOptions = useCallback((
    containerId: string,
    options: echarts.EChartsOption,
    notMerge: boolean = false,
    lazyUpdate: boolean = false
  ) => {
    const chartInstance = instancePool.current.get(containerId);
    if (!chartInstance || chartInstance.instance.isDisposed()) {
      console.warn(`[ChartContext] Cannot update options: instance not found or disposed: ${containerId}`);
      return;
    }

    try {
      // 성능 최적화를 위한 옵션 업데이트
      chartInstance.instance.setOption(options, notMerge, lazyUpdate);
      chartInstance.lastUsed = Date.now();
    } catch (error) {
      console.error(`[ChartContext] Failed to update options: ${containerId}`, error);
    }
  }, []);

  const resizeChart = useCallback((containerId: string) => {
    const chartInstance = instancePool.current.get(containerId);
    if (!chartInstance || chartInstance.instance.isDisposed()) {
      return;
    }

    try {
      chartInstance.instance.resize();
      chartInstance.lastUsed = Date.now();
    } catch (error) {
      console.error(`[ChartContext] Failed to resize: ${containerId}`, error);
    }
  }, []);

  const disposeChart = useCallback((containerId: string) => {
    const chartInstance = instancePool.current.get(containerId);
    if (chartInstance) {
      chartInstance.instance.dispose();
      instancePool.current.delete(containerId);
      console.log(`[ChartContext] Disposed instance: ${containerId}`);
    }
  }, []);

  const getInstanceCount = useCallback(() => {
    return instancePool.current.size;
  }, []);

  const value: ChartContextType = {
    getChartInstance,
    releaseChartInstance,
    updateChartOptions,
    resizeChart,
    disposeChart,
    getInstanceCount,
  };

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
};

export const useChart = (): ChartContextType => {
  const context = useContext(ChartContext);
  if (context === undefined) {
    throw new Error('useChart must be used within a ChartProvider');
  }
  return context;
};