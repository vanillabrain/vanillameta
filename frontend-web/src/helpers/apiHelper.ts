import { editorDraftSessionEpoch, retainEditorDraftSession } from '@/helpers/editorDraftStorage';
import axios from 'axios';
import { getToken, removeToken, setToken } from '@/helpers/authHelper';
import { getShareToken } from '@/helpers/shareHelper';
import authService from '@/api/authService';
import { getSocketId } from '@/helpers/socket';

// apply base url for axios
const API_URL = import.meta.env.REACT_APP_API_URL;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  // withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let pendingRequests = {};
let isLoginUser = true;
// console.log('pendingRequests', pendingRequests);

// 요청에 대한 unique key 생성
const generateReqKey = config => {
  const { method, url, params, data } = config;
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&');
};

// 진행중인 요청 저장
const addPendingRequest = config => {
  const requestKey = generateReqKey(config);
  config.cancelToken =
    config.cancelToken ||
    new axios.CancelToken(cancel => {
      if (!pendingRequests[requestKey]) {
        pendingRequests[requestKey] = [];
      }
      pendingRequests[requestKey].push(cancel);
    });
};

// 저장된 요청 취소
const removePendingRequest = config => {
  const requestKey = generateReqKey(config);
  if (pendingRequests[requestKey]) {
    pendingRequests[requestKey].forEach(cancel => {
      cancel('Request canceled due to new request.');
    });
    delete pendingRequests[requestKey];
  }
};

// 토큰 정보 요청 header에 삽입
const addAuthToHeaders = config => {
  const token = getToken();
  const shareToken = getShareToken();

  const sharedWidgetRead =
    shareToken &&
    /^(?:\/share\/|\/embed\/)/.test(window.location.pathname) &&
    config.method === 'get' &&
    config.url.split('?')[0] === '/database/data';
  if (sharedWidgetRead) {
    isLoginUser = false;
    config.headers['Authorization-url'] = `Bearer ${shareToken}`;
    delete config.headers.Authorization;
  } else if (token) {
    isLoginUser = true;
    config.headers.Authorization = `Bearer ${token}`;
    config._authEpoch = editorDraftSessionEpoch();
    delete config.headers['Authorization-url'];
  } else if (shareToken && config.url.includes('/database')) {
    // token 없는 외부 사용자가 share url에 필요한 db api 호출을 할 때만 auth로 shareToken 보내기
    isLoginUser = false;
    config.headers['Authorization-url'] = `Bearer ${shareToken}`;
  }
  return config;
};

// Keep main's correlation and timing metadata on each request (concurrent identical URLs stay independent).
const recordApiPerformance = (config, status: number) => {
  if (!config?.metadata || /^\/(?:v1\/)?events(?:\/|$)/.test(config.url || '')) return;
  // Analytics remains governed by the existing persisted consent; never include private URLs or payloads.
  if (localStorage.getItem('vanillameta_analytics_consent') !== 'true') return;
  const duration = performance.now() - config.metadata.startTime;
  void import('@/utils/analytics')
    .then(({ trackTiming }) => {
      trackTiming('api_response_time', duration, 'api_performance', `${config.method?.toUpperCase()} ${status}`);
    })
    .catch(() => undefined);
};

// 요청 인터셉터
instance.interceptors.request.use(async config => {
  const newConfig = addAuthToHeaders(config);
  newConfig.headers['X-Correlation-ID'] ||=
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  newConfig.metadata = { startTime: performance.now(), correlationId: newConfig.headers['X-Correlation-ID'] };
  const socketId = getSocketId();
  if (socketId) newConfig.headers['x-socket-id'] = socketId;
  // removePendingRequest(newConfig); // 같은 요청이 갔을 경우 기존 요청 취소
  // addPendingRequest(newConfig);
  return newConfig;
});

// 중단 이벤트 발생 시 모든 요청 중단
export function cancelAllRequests() {
  Object.keys(pendingRequests).forEach(key => {
    pendingRequests[key].forEach(cancel => {
      cancel('All requests canceled');
    });
  });
  pendingRequests = {};
}

let refreshPromise: Promise<string> | null = null;

const responseMessage = data => {
  const candidate = typeof data === 'string' ? data : data?.message ?? data?.data;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate?.message === 'string') return candidate.message;
  return undefined;
};

// 응답 인터셉터
instance.interceptors.response.use(
  response => {
    recordApiPerformance(response.config, response.status);
    // removePendingRequest(response.config); // 완료된 요청 삭제
    return response;
  },
  async error => {
    const { response: errorResponse } = error;
    recordApiPerformance(error.config, errorResponse?.status || 0);
    const message = responseMessage(errorResponse?.data);
    const requestConfig = error.config ?? errorResponse?.config;
    if (
      errorResponse?.status === 401 &&
      message === 'accessTokenExpired' &&
      isLoginUser &&
      requestConfig &&
      !requestConfig._retry &&
      requestConfig.url !== '/user/get-access-token'
    ) {
      // 로그인 사용자의 token 만료 후 첫 요청
      requestConfig._retry = true;
      return await resetTokenAndReattemptRequest({ ...errorResponse, config: requestConfig });
    }
    error.message = message || error?.message || error.toString();
    return Promise.reject(error);
  },
);

async function resetTokenAndReattemptRequest(errorResponse) {
  // subscribers에 access token을 받은 이후 재요청할 함수 추가 (401로 실패했던)
  // retryOriginalRequest는 pending 상태로 있다가
  // access token을 받은 이후 onAccessTokenFetched가 호출될 때
  // access token을 넘겨 다시 axios로 요청하고
  // 결과값을 처음 요청했던 promise의 resolve로 settle시킨다.
  // refresh token을 이용해서 access token 요청
  const accessToken = await renewAccessToken(errorResponse.config);
  errorResponse.config.headers = errorResponse.config.headers || {};
  errorResponse.config.headers.Authorization = `Bearer ${accessToken}`;
  return instance(errorResponse.config); // pending 됐다가 onAccessTokenFetched가 호출될 때 resolve
}

/**
 * The shared, cross-tab-locked access token renewal for a request that was sent with `config`
 * (its Authorization header and `_authEpoch`). Resolves with the token to retry with; rejects when the
 * session changed meanwhile, so a retry never runs under another identity.
 */
async function renewAccessToken(config) {
  const requestEpoch = config._authEpoch;
  if (editorDraftSessionEpoch() !== requestEpoch) throw new Error('Authentication changed. Retry the request.');
  if (!refreshPromise) {
    const previousToken = String(config.headers?.Authorization ?? '').replace(/^Bearer /, '');
    const previousEpoch = requestEpoch;
    const unchanged = () => getToken() === previousToken && editorDraftSessionEpoch() === previousEpoch;
    const winner = () => {
      const current = getToken();
      return previousEpoch !== null && editorDraftSessionEpoch() === previousEpoch && current && current !== previousToken
        ? current
        : null;
    };
    let refreshStarted = false;
    const renew = async () => {
      const current = winner();
      if (current) return current;
      if (!unchanged()) throw new Error('Authentication changed while refreshing. Retry the request.');
      refreshStarted = true;
      const { data } = await authService.refreshAccessToken();
      const newAccessToken = data?.accessToken;
      if (typeof newAccessToken !== 'string' || !newAccessToken.trim()) throw new Error('invalid refresh response');
      if (!unchanged()) throw new Error('Authentication changed while refreshing. Retry the request.');
      await retainEditorDraftSession(previousToken, newAccessToken, previousEpoch);
      if (!unchanged()) throw new Error('Authentication changed while refreshing. Retry the request.');
      setToken(newAccessToken, true);
      return newAccessToken;
    };
    refreshPromise = (async () => {
      if (typeof navigator === 'undefined' || !navigator.locks?.request) return renew();
      // UC-029: coordinate only the auth renewal, never dashboard writes, across same-origin tabs.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 10000);
      try {
        return await navigator.locks.request('vm:auth-refresh:v1', { signal: abort.signal }, () => {
          clearTimeout(timer);
          return renew();
        });
      } finally {
        clearTimeout(timer);
      }
    })()
      .catch(error => {
        const current = winner();
        if (current) return current;
        // Lock acquisition failure must not destroy a valid session or its unsaved drafts.
        // UC-030: transport/server failures leave the session and draft retryable.
        const refreshStatus = error?.response?.status;
        if (refreshStarted && (refreshStatus === 401 || refreshStatus === 403) && unchanged()) {
          removeToken();
          window.location.assign('/login');
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  const accessToken = await refreshPromise;
  if (editorDraftSessionEpoch() !== requestEpoch) throw new Error('Authentication changed. Retry the request.');
  return accessToken;
}

export async function get(url, data?, config = {}): Promise<any> {
  return instance.get(url, { params: { ...data }, ...config });
}

export async function postForm(url, data: FormData, config = {}): Promise<any> {
  return instance.post(url, data, { ...config, headers: { 'Content-Type': undefined } });
}

export async function post(url, data?, config = {}): Promise<any> {
  return instance.post(url, { ...data }, { ...config });
}

export async function put(url, data?, config = {}): Promise<any> {
  return instance.put(url, { ...data }, { ...config });
}

export async function del(url, config = {}): Promise<any> {
  return instance.delete(url, { ...config });
}

export async function patch(url, data?, config = {}): Promise<any> {
  return instance.patch(url, { ...data }, { ...config });
}

/**
 * What a request made with `fetch` (an NDJSON stream; the interceptors above never see it) needs to look
 * like one made with axios: the base URL, the session's token, and the epoch the token belongs to.
 */
export function fetchAuthContext() {
  return { baseURL: String(API_URL ?? ''), token: getToken(), epoch: editorDraftSessionEpoch() };
}

/**
 * The same renewal the axios interceptor does after a 401 `accessTokenExpired`, for a `fetch` request that
 * was sent with `sent` (from `fetchAuthContext`). Resolves with the token to retry with.
 */
export async function renewAccessTokenForFetch(sent: { token: string | null; epoch: unknown }): Promise<string> {
  if (!isLoginUser) throw new Error('Not a login session.');
  return renewAccessToken({ headers: { Authorization: `Bearer ${sent.token ?? ''}` }, _authEpoch: sent.epoch });
}

export default instance;
