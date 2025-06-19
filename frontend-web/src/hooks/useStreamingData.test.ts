import { renderHook, act } from '@testing-library/react';
import { useStreamingData } from './useStreamingData';
import DatasetService from '@/api/datasetService';

// Mock DatasetService
jest.mock('@/api/datasetService');

describe('useStreamingData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() => useStreamingData());

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it('스트리밍 시작 시 상태가 업데이트되어야 함', async () => {
    const mockStreamDataset = jest.fn().mockImplementation(() => Promise.resolve());
    (DatasetService.streamDataset as jest.Mock).mockImplementation(mockStreamDataset);

    const { result } = renderHook(() => useStreamingData());

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockStreamDataset).toHaveBeenCalledWith('test-dataset-id', expect.any(Object));
  });

  it('데이터 청크를 받으면 버퍼링 후 배치 업데이트해야 함', async () => {
    jest.useFakeTimers();
    
    let onDataCallback: any;
    const mockStreamDataset = jest.fn().mockImplementation((_id, options) => {
      onDataCallback = options.onData;
      return Promise.resolve();
    });
    (DatasetService.streamDataset as jest.Mock).mockImplementation(mockStreamDataset);

    const { result } = renderHook(() => useStreamingData());

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    // 데이터 청크 시뮬레이션
    act(() => {
      onDataCallback({ rows: [{ id: 1, value: 'test1' }] });
      onDataCallback({ rows: [{ id: 2, value: 'test2' }] });
    });

    // 배치 업데이트 전에는 데이터가 비어있어야 함
    expect(result.current.data).toEqual([]);

    // 100ms 후 배치 업데이트 실행
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data).toEqual([
      { id: 1, value: 'test1' },
      { id: 2, value: 'test2' },
    ]);

    jest.useRealTimers();
  });

  it('최대 데이터 크기를 초과하면 오래된 데이터를 제거해야 함', async () => {
    jest.useFakeTimers();
    
    let onDataCallback: any;
    const mockStreamDataset = jest.fn().mockImplementation((_id, options) => {
      onDataCallback = options.onData;
      return Promise.resolve();
    });
    (DatasetService.streamDataset as jest.Mock).mockImplementation(mockStreamDataset);

    const { result } = renderHook(() => useStreamingData({ maxDataSize: 2 }));

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    // 3개의 데이터 청크 시뮬레이션
    act(() => {
      onDataCallback({ rows: [{ id: 1 }, { id: 2 }] });
      onDataCallback({ rows: [{ id: 3 }] });
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // 최대 크기 2이므로 최신 2개만 유지
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data).toEqual([{ id: 2 }, { id: 3 }]);

    jest.useRealTimers();
  });

  it('진행률 업데이트를 처리해야 함', async () => {
    let onProgressCallback: any;
    const mockStreamDataset = jest.fn().mockImplementation((_id, options) => {
      onProgressCallback = options.onProgress;
      return Promise.resolve();
    });
    (DatasetService.streamDataset as jest.Mock).mockImplementation(mockStreamDataset);

    const { result } = renderHook(() => useStreamingData());

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    act(() => {
      onProgressCallback({ current: 1000, total: 10000, percentage: 10 });
    });

    expect(result.current.progress).toEqual({
      current: 1000,
      total: 10000,
      percentage: 10,
    });
  });

  it('스트리밍 중단 시 상태가 올바르게 정리되어야 함', async () => {
    const abortMock = jest.fn();
    global.AbortController = jest.fn().mockImplementation(() => ({
      abort: abortMock,
      signal: {},
    })) as any;

    const { result } = renderHook(() => useStreamingData());

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    act(() => {
      result.current.stopStreaming();
    });

    expect(abortMock).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it('에러 발생 시 에러 상태가 설정되어야 함', async () => {
    let onErrorCallback: any;
    const mockStreamDataset = jest.fn().mockImplementation((_id, options) => {
      onErrorCallback = options.onError;
      return Promise.resolve();
    });
    (DatasetService.streamDataset as jest.Mock).mockImplementation(mockStreamDataset);

    const { result } = renderHook(() => useStreamingData());

    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    act(() => {
      onErrorCallback(new Error('스트리밍 오류'));
    });

    expect(result.current.error).toBe('스트리밍 오류');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it('clearData 호출 시 모든 데이터가 초기화되어야 함', async () => {
    const { result } = renderHook(() => useStreamingData());

    // 데이터 설정
    await act(async () => {
      await result.current.startStreaming('test-dataset-id');
    });

    act(() => {
      result.current.clearData();
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });
});