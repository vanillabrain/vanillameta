import { useState, useCallback, useRef, useEffect } from 'react';
import DatasetService from '@/api/datasetService';

export interface StreamingDataState {
  data: any[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  progress: {
    current: number;
    total?: number;
    percentage?: number;
  } | null;
}

export interface UseStreamingDataOptions {
  onDataChunk?: (chunk: any) => void;
  maxDataSize?: number; // 최대 데이터 크기 (행 수)
  chunkSize?: number; // 청크 크기
}

export const useStreamingData = (options?: UseStreamingDataOptions) => {
  const [state, setState] = useState<StreamingDataState>({
    data: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    progress: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const dataBufferRef = useRef<any[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 데이터 버퍼 플러시 및 상태 업데이트
  const flushDataBuffer = useCallback(() => {
    if (dataBufferRef.current.length > 0) {
      setState(prev => ({
        ...prev,
        data: [...prev.data, ...dataBufferRef.current].slice(
          -(options?.maxDataSize || 100000), // 최대 10만 행 유지
        ),
      }));
      dataBufferRef.current = [];
    }
  }, [options?.maxDataSize]);

  // 배치 업데이트를 위한 디바운스 처리
  const scheduleUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      flushDataBuffer();
    }, 100); // 100ms마다 배치 업데이트
  }, [flushDataBuffer]);

  // 스트리밍 시작
  const startStreaming = useCallback(
    async (datasetId: string) => {
      // 이전 스트리밍 중단
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 새로운 AbortController 생성
      abortControllerRef.current = new AbortController();

      // 상태 초기화
      setState({
        data: [],
        isLoading: true,
        isStreaming: true,
        error: null,
        progress: null,
      });
      dataBufferRef.current = [];

      try {
        await DatasetService.streamDataset(datasetId, {
          signal: abortControllerRef.current.signal,
          onData: chunk => {
            // 데이터 청크 처리
            if (chunk.rows) {
              dataBufferRef.current.push(...chunk.rows);
              options?.onDataChunk?.(chunk);
              scheduleUpdate();
            }
          },
          onProgress: progress => {
            setState(prev => ({ ...prev, progress }));
          },
          onError: error => {
            setState(prev => ({
              ...prev,
              error: error.message || '스트리밍 중 오류가 발생했습니다.',
              isLoading: false,
              isStreaming: false,
            }));
          },
          onComplete: () => {
            // 마지막 버퍼 플러시
            flushDataBuffer();
            setState(prev => ({
              ...prev,
              isLoading: false,
              isStreaming: false,
            }));
          },
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setState(prev => ({
            ...prev,
            error: error.message || '스트리밍을 시작할 수 없습니다.',
            isLoading: false,
            isStreaming: false,
          }));
        }
      }
    },
    [options, scheduleUpdate, flushDataBuffer],
  );

  // 스트리밍 중단
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 타이머 정리
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // 마지막 버퍼 플러시
    flushDataBuffer();

    setState(prev => ({
      ...prev,
      isLoading: false,
      isStreaming: false,
    }));
  }, [flushDataBuffer]);

  // 데이터 클리어
  const clearData = useCallback(() => {
    setState({
      data: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      progress: null,
    });
    dataBufferRef.current = [];
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startStreaming,
    stopStreaming,
    clearData,
  };
};
