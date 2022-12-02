import { AuthContext } from '@/contexts/AuthContext';
import { useContext, useEffect } from 'react';
import instance from '@/helpers/apiHelper';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';

const useAuthAxios = () => {
  const { token, refreshToken } = useContext(AuthContext);
  const alert = useAlert();
  const navigate = useNavigate();
  let isAlreadyFetchingAccessToken = false;

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

  const responseInterceptor = instance.interceptors.response.use(
    response => {
      return response;
    },
    async error => {
      const originRequest = error?.config;
      if (error?.response?.data?.message === 'accessTokenExpired' && !isAlreadyFetchingAccessToken) {
        isAlreadyFetchingAccessToken = true;
        const newToken = refreshToken();

        originRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return instance(originRequest);
      }
      // error.message =
      //   (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
      alert.error('로그인이 만료되었습니다.\n다시 로그인 해주세요.', {
        close: () => {
          navigate('/login');
          console.log('/login');
        },
      });
      return Promise.reject(error);
    },
  );
  useEffect(() => {
    return () => {
      instance.interceptors.request.eject(requestInterceptor);
      instance.interceptors.response.eject(responseInterceptor);
    };
  }, [requestInterceptor, responseInterceptor]);
};

export default useAuthAxios;
