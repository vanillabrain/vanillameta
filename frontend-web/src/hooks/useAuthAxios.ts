import { AuthContext } from '@/contexts/AuthContext';
import { useContext, useEffect } from 'react';
import instance from '@/helpers/apiHelper';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';

const useAuthAxios = () => {
  const { token, refreshToken } = useContext(AuthContext);
  const alert = useAlert();
  const navigate = useNavigate();
  let isAlreadyRefreshingToken = false;

  // 요청 interceptor
  const requestInterceptor = instance.interceptors.request.use(
    async config => {
      // console.log(token, 'token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    error => {
      return Promise.reject(error);
    },
  );

  // 응답 interceptor
  const responseInterceptor = instance.interceptors.response.use(
    response => {
      return response;
    },
    async error => {
      const originRequest = error?.config;
      if (error?.response?.data?.data?.message === 'accessTokenExpired' && !isAlreadyRefreshingToken) {
        // token 만료 후 첫 요청
        isAlreadyRefreshingToken = true;
        try {
          const refresh = await refreshToken();
          if (refresh.status === 201) {
            const newToken = refresh.data.accessToken;
            originRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return instance(originRequest); // 최초의 요청을 반환하여 다시 호출
          }
        } catch (error) {
          console.log('refresh token 없음!', error);
          alert.error('로그인이 만료되었습니다.\n다시 로그인 해주세요.', {
            onClose: () => {
              navigate('/login');
            },
          });
        }
      } else {
        // token 과 관련없는 요청
        return Promise.reject(error);
      }
    },
  );

  // 추가한 interceptor 동작 종료 후에 제거
  useEffect(() => {
    return () => {
      instance.interceptors.request.eject(requestInterceptor);
      instance.interceptors.response.eject(responseInterceptor);
    };
  }, []);
};

export default useAuthAxios;
