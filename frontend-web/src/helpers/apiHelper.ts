import axios from 'axios';
import { AuthContext } from '@/contexts/AuthContext';
import { useContext } from 'react';
import authService from '@/api/authService';
import { getToken } from '@/helpers/authHelper';

// apply base url for axios
const API_URL = process.env.REACT_APP_API_URL;

let isAlreadyFetchingAccessToken = false;
let subscribers = [];

const instance = axios.create({
  baseURL: API_URL,
  timeout: 100000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// request interceptor
instance.interceptors.request.use(async config => {
  const token = await getToken();
  console.log(token, 'token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // if (config.url === URL_REFRESH || config.url === URL_LOGOUT) {
  //   config.headers.RefreshAuthorization = getRefreshToken();
  // }
  return config;
});

// response interceptor
instance.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    if (error?.response?.status) {
      const {
        response: { status },
      } = error;
      console.log(error, 'error');
      if (status === 401) {
        if (error.response.data.message === 'accessTokenExpired') {
          return await resetTokenAndReattemptRequest(error);
        }
        //
        //   if (error.response.data.message === 'JsonWebTokenError') {
        //     removeToken();
        //     window.location.reload();
        //   } else
        // if (error.response.data.message === 'Unauthorized') {
        // 권한없음
        // const navigate = useNavigate();
        // navigate(ROUTE_URL_LOGIN);
        // }
      }
      error.message =
        (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
      return Promise.reject(error);
    }
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

      const { data } = await authService.getAccessToken();
      console.log(data, 'token');
      // 새로운 토큰 저장
      const newAccessToken = data.accessToken;
      const { setToken } = useContext(AuthContext);
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
  // return await instance.get(url, { params: { ...data } }, { ...config }).then((response) => response.data);
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
