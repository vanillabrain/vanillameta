import { del, get, post, put } from '@/helpers/apiHelper';
import {
  ApiResponse,
  CreateDatasetRequest,
  UpdateDatasetRequest,
  DatasetListResponse,
  DatasetDetailResponse,
  Dataset,
} from '@/types';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getToken } from '@/helpers/authHelper';

export const SERVICE_URL = '/dataset';

const selectDatasetList = (): Promise<ApiResponse<Dataset[]>> => get<ApiResponse<Dataset[]>>(SERVICE_URL);

const selectDataset = (id: string, data = null): Promise<ApiResponse<DatasetDetailResponse>> =>
  get<ApiResponse<DatasetDetailResponse>>(SERVICE_URL + '/' + id, data);

const createDataset = (data: CreateDatasetRequest): Promise<ApiResponse<Dataset>> =>
  post<ApiResponse<Dataset>>(SERVICE_URL, data);

const updateDataset = (id: string, data: UpdateDatasetRequest): Promise<ApiResponse<Dataset>> =>
  put<ApiResponse<Dataset>>(SERVICE_URL + '/' + id, data);

const deleteDataset = (id: string): Promise<ApiResponse<null>> => del<ApiResponse<null>>(SERVICE_URL + '/' + id);

// 스트리밍 데이터셋 쿼리 실행
interface StreamingOptions {
  onData: (data: any) => void;
  onProgress?: (progress: { current: number; total?: number; percentage?: number }) => void;
  onError?: (error: any) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

const streamDataset = async (id: string, options: StreamingOptions): Promise<void> => {
  const token = getToken();
  const baseURL = process.env.REACT_APP_API_URL || '';
  
  await fetchEventSource(`${baseURL}/api/v1${SERVICE_URL}/${id}/stream`, {
    method: 'GET',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Accept': 'application/x-ndjson',
    },
    signal: options.signal,
    onopen: async (response) => {
      if (response.ok && response.headers.get('content-type')?.includes('application/x-ndjson')) {
        return; // 연결 성공
      } else if (response.status >= 400) {
        throw new Error(`Server error: ${response.status}`);
      }
    },
    onmessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 진행률 정보 처리
        if (data.type === 'progress' && options.onProgress) {
          options.onProgress({
            current: data.current,
            total: data.total,
            percentage: data.percentage,
          });
        }
        // 데이터 청크 처리
        else if (data.type === 'data' || data.rows) {
          options.onData(data);
        }
        // 완료 메시지 처리
        else if (data.type === 'complete') {
          options.onComplete?.();
        }
      } catch (error) {
        console.error('Failed to parse streaming data:', error);
        options.onError?.(error);
      }
    },
    onerror: (err) => {
      console.error('Streaming error:', err);
      options.onError?.(err);
      throw err; // 재연결 방지
    },
  });
};

// 캐시된 데이터셋 쿼리 실행
const executeCachedQuery = (
  id: string, 
  options?: { 
    forceRefresh?: boolean; 
    ttl?: number; 
    useStreamingFallback?: boolean;
  }
): Promise<ApiResponse<any>> => {
  const params = new URLSearchParams();
  if (options?.forceRefresh) params.append('forceRefresh', 'true');
  if (options?.ttl) params.append('ttl', options.ttl.toString());
  if (options?.useStreamingFallback) params.append('useStreamingFallback', 'true');
  
  const queryString = params.toString();
  const url = `${SERVICE_URL}/${id}/cached${queryString ? '?' + queryString : ''}`;
  
  return get<ApiResponse<any>>(url);
};

const DatasetService = {
  selectDatasetList,
  selectDataset,
  createDataset,
  updateDataset,
  deleteDataset,
  streamDataset,
  executeCachedQuery,
};

export default DatasetService;
