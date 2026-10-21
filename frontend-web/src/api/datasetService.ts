import { del, get, post, put } from '@/helpers/apiHelper';
import { getToken } from '@/helpers/authHelper';
import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';

export const SERVICE_URL = '/dataset';

const selectDatasetList = (): Promise<any> => get(SERVICE_URL);
const selectDataset = (id: string | number, data = null): Promise<any> => get(SERVICE_URL + '/' + id, data);
const createDataset = (data: unknown): Promise<any> => post(SERVICE_URL, data);
const updateDataset = (id: string | number, data: unknown): Promise<any> => put(SERVICE_URL + '/' + id, data);
const deleteDataset = (id: string | number): Promise<any> => del(SERVICE_URL + '/' + id);

export interface StreamingOptions {
  onData: (data: { rows: any[] }) => void;
  onProgress?: (progress: { current: number; total?: number; percentage?: number }) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

// The server emits newline-delimited JSON, not SSE. Never reconnect or replay a query automatically.
export async function streamDataset(id: string, options: StreamingOptions): Promise<void> {
  const epoch = editorDraftSessionEpoch();
  const token = getToken();
  const current = () => !options.signal?.aborted && epoch === editorDraftSessionEpoch() && token === getToken();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const base = (import.meta.env.REACT_APP_API_URL || '').replace(/\/$/, '');
    const response = await fetch(`${base}${SERVICE_URL}/${encodeURIComponent(id)}/stream`, {
      credentials: 'include',
      signal: options.signal,
      headers: { Accept: 'application/x-ndjson', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!current()) {
      await response.body?.cancel();
      return;
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson') || !response.body) {
      throw new Error(`스트리밍 조회에 실패했습니다. (${response.status})`);
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    let count = 0;
    const consume = (line: string) => {
      if (!line.trim() || !current()) return;
      const message = JSON.parse(line);
      if (message.type === 'error') throw new Error('스트리밍 조회 중 오류가 발생했습니다.');
      if (message.type === 'data') {
        const rows = Array.isArray(message.data) ? message.data : [message.data];
        if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
          throw new Error('잘못된 스트리밍 데이터입니다.');
        count += rows.length;
        options.onData({ rows });
        options.onProgress?.({ current: count });
      } else if (message.type === 'complete') {
        completed = true;
      }
    };
    while (current()) {
      const chunk = await reader.read();
      if (!current()) return;
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
      if (chunk.done) break;
    }
    consume(buffer);
    if (current()) {
      if (!completed) throw new Error('스트리밍 연결이 완료 전에 중단되었습니다.');
      options.onComplete?.();
    }
  } catch (error) {
    if (current()) {
      options.onError?.(error as Error);
      throw error;
    }
  } finally {
    await reader?.cancel().catch(() => undefined);
  }
}

export const executeCachedQuery = (
  id: string,
  options?: { forceRefresh?: boolean; ttl?: number; useStreamingFallback?: boolean },
) => get(`${SERVICE_URL}/${encodeURIComponent(id)}/cached`, options);

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
