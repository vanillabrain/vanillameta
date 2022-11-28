import { AuthContext } from '@/contexts/AuthContext';
import { useContext, useEffect } from 'react';
import instance from '@/helpers/apiHelper';

const useAuthAxios = () => {
  const { token, onRefresh } = useContext(AuthContext);
  const newToken = onRefresh();
  let isAlreadyFetchingAccessToken = false;

  return () => {
    const requestInterceptor = instance.interceptors.request.use(
      async config => {
        console.log(token, 'token');
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
          originRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return instance(originRequest);
        }
        error.message =
          (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
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
};

export default useAuthAxios;
