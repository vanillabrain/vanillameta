import axios from 'axios';
import { getToken, setToken } from '@/helpers/authHelper';
import { getShareToken } from '@/helpers/shareHelper';
import authService from '@/api/authService';

// apply base url for axios
const API_URL = process.env.REACT_APP_API_URL;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isLoginUser = true;
let isAlreadyFetchingAccessToken = false;
let subscribers: ((token: string) => void)[] = [];

// request interceptor
instance.interceptors.request.use(async config => {
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
});

// response interceptor
instance.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const {
      response: { status },
    } = error;
    if (status === 401) {
      if (error.response.data.data === 'accessTokenExpired' && isLoginUser) {
        // 로그인 사용자의 token 만료 후 첫 요청
        return await resetTokenAndReattemptRequest(error);
      }
    }
    error.message =
      (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return Promise.reject(error);
  },
);

async function resetTokenAndReattemptRequest(error) {
  try {
    const { response: errorResponse } = error;

    // subscribers에 access token을 받은 이후 재요청할 함수 추가 (401로 실패했던)
    // retryOriginalRequest는 pending 상태로 있다가
    // access token을 받은 이후 onAccessTokenFetched가 호출될 때
    // access token을 넘겨 다시 axios로 요청하고
    // 결과값을 처음 요청했던 promise의 resolve로 settle시킨다.
    const retryOriginalRequest = new Promise((resolve, reject) => {
      addSubscriber(async accessToken => {
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

      onAccessTokenFetched(data.access);
    }

    return retryOriginalRequest; // pending 됐다가 onAccessTokenFetched가 호출될 때 resolve
  } catch (error) {
    return Promise.reject(error);
  }
}

function addSubscriber(callback) {
  subscribers.push(callback);
}

function onAccessTokenFetched(accessToken) {
  subscribers.forEach(callback => callback(accessToken));
  subscribers = [];
}

export async function get(url, data?, config = {}) {
  return instance.get(url, { params: { ...data }, ...config });
}

export async function post(url, data?, config = {}) {
  return instance.post(url, { ...data }, { ...config });
}

export async function put(url, data?, config = {}) {
  return instance.put(url, { ...data }, { ...config });
}

export async function del(url, config = {}) {
  return instance.delete(url, { ...config });
}

export async function postForm(url, data?, config = {}) {
  return instance.post(url, data, { ...config });
}

export async function patch(url, data?, config = {}) {
  return instance.patch(url, { ...data }, { ...config });
}

export default instance;
