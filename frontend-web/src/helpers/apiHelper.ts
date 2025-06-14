import axios, { AxiosResponse } from 'axios';
import { getToken, removeToken, setToken } from '@/helpers/authHelper';
import { getShareToken } from '@/helpers/shareHelper';
import authService from '@/api/authService';

// Correlation ID 생성 함수
const generateCorrelationId = (): string => {
  // UUID v4 생성 (crypto.randomUUID가 있으면 사용, 없으면 Math.random 기반 생성)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // 폴백: Math.random 기반 UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// apply base url for axios
const API_URL = process.env.REACT_APP_API_URL;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
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

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (shareToken && config.url.includes('/database')) {
    // token 없는 외부 사용자가 share url에 필요한 db api 호출을 할 때만 auth로 shareToken 보내기
    isLoginUser = false;
    config.headers['Authorization-url'] = `Bearer ${shareToken}`;
  }
  return config;
};

// Correlation ID를 요청 헤더에 추가
const addCorrelationIdToHeaders = config => {
  // 이미 correlation ID가 설정되어 있지 않은 경우에만 새로 생성
  if (!config.headers['X-Correlation-ID'] && !config.headers['x-correlation-id']) {
    config.headers['X-Correlation-ID'] = generateCorrelationId();
  }
  return config;
};

// 요청 인터셉터
instance.interceptors.request.use(async config => {
  let newConfig = addAuthToHeaders(config);
  newConfig = addCorrelationIdToHeaders(newConfig);
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

let isAlreadyFetchingAccessToken = false;
const subscribers: ((token: string) => void)[] = [];

// 응답 인터셉터
instance.interceptors.response.use(
  response => {
    // removePendingRequest(response.config); // 완료된 요청 삭제

    // 디버깅을 위해 correlation ID 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      const correlationId = response.headers['x-correlation-id'] || response.headers['X-Correlation-ID'];
      if (correlationId) {
        console.log(
          `[API Response] ${response.config.method?.toUpperCase()} ${
            response.config.url
          } - Correlation ID: ${correlationId}`,
        );
      }
    }

    return response;
  },
  async error => {
    const { response: errorResponse } = error;

    // 에러 응답에서도 correlation ID 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development' && errorResponse) {
      const correlationId =
        errorResponse.headers?.['x-correlation-id'] ||
        errorResponse.headers?.['X-Correlation-ID'] ||
        errorResponse.data?.correlationId;
      if (correlationId) {
        console.error(
          `[API Error] ${errorResponse.config?.method?.toUpperCase()} ${
            errorResponse.config?.url
          } - Correlation ID: ${correlationId}, Status: ${errorResponse.status}`,
        );
      }
    }

    if (errorResponse?.status === 401 && errorResponse?.data?.message === 'accessTokenExpired' && isLoginUser) {
      // 로그인 사용자의 token 만료 후 첫 요청
      await resetTokenAndReattemptRequest(errorResponse);
    }
    error.message =
      (errorResponse && errorResponse?.data && errorResponse?.data?.message) || error?.message || error.toString();
    return Promise.reject(error);
  },
);

async function resetTokenAndReattemptRequest(errorResponse) {
  // subscribers에 access token을 받은 이후 재요청할 함수 추가 (401로 실패했던)
  // retryOriginalRequest는 pending 상태로 있다가
  // access token을 받은 이후 onAccessTokenFetched가 호출될 때
  // access token을 넘겨 다시 axios로 요청하고
  // 결과값을 처음 요청했던 promise의 resolve로 settle시킨다.
  try {
    const retryOriginalRequest = new Promise((resolve, reject) => {
      subscribers.push(async accessToken => {
        try {
          errorResponse.config.headers.Authorization = accessToken;
          resolve(instance(errorResponse.config));
        } catch (err) {
          reject(err);
        }
      });
    });

    // refresh token을 이용해서 access token 요청
    if (!isAlreadyFetchingAccessToken) {
      isAlreadyFetchingAccessToken = true; // 문닫기 (한 번만 요청)

      const { data } = await authService.refreshAccessToken();
      // 새로운 토큰 저장
      console.log('data', data);
      const newAccessToken = data.accessToken;
      setToken(newAccessToken);

      isAlreadyFetchingAccessToken = false; // 문열기 (초기화)
      onAccessTokenFetched(data.accessToken);
    }
    return retryOriginalRequest; // pending 됐다가 onAccessTokenFetched가 호출될 때 resolve
  } catch (error) {
    console.log('error', error);
    if (error.response.status === 401) {
      // refresh token 만료
      removeToken();
    }
    return Promise.reject(error);
  }
}

function onAccessTokenFetched(accessToken) {
  subscribers.forEach(callback => callback(accessToken));
  subscribers.length = 0;
}

export async function get<T = any>(url: string, data?: any, config = {}): Promise<T> {
  const response = await instance.get(url, { params: { ...data }, ...config });
  return response.data;
}

export async function post<T = any>(url: string, data?: any, config = {}): Promise<T> {
  const response = await instance.post(url, { ...data }, { ...config });
  return response.data;
}

export async function put<T = any>(url: string, data?: any, config = {}): Promise<T> {
  const response = await instance.put(url, { ...data }, { ...config });
  return response.data;
}

export async function del<T = any>(url: string, config = {}): Promise<T> {
  const response = await instance.delete(url, { ...config });
  return response.data;
}

export async function patch<T = any>(url: string, data?: any, config = {}): Promise<T> {
  const response = await instance.patch(url, { ...data }, { ...config });
  return response.data;
}

export default instance;
