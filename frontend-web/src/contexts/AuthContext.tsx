import { createContext, useState } from 'react';
import authService from '@/api/authService';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const initUserState = {
    userId: null,
    userEmail: null,
  };
  const [userState, setUserState] = useState(initUserState);

  const setLogin = data => {
    setToken(data);
    navigate('/dashboard');
  };

  const setLogout = () => {
    setToken(null);
    setUserState(initUserState);
  };

  const refreshToken = async () => {
    authService
      .refreshAccessToken()
      .then(response => {
        // console.log('refreshToken', response);
        if (response.status === 201) {
          setToken(response?.data?.accessToken);
          return response?.data?.accessToken;
          // return new Promise(response);
        }
      })
      .catch(error => {
        console.log(error, 'refresh error');
        return Promise.reject(error);
        // if (error.response.status === 401) {
        // throw new Error(error.response.statusText);
        // }
      });
  };

  const getUserState = async () => {
    // if (token) {
    authService
      .getUserInfo()
      .then(response => {
        if (response.status === 200) {
          setUserState({ userId: response.data.data.user_id, userEmail: response.data.data.email });
          return response;
        }
      })
      .catch(error => {
        console.log(error);
        throw new Error(error.response.statusText);
      });
    // }
  };

  const value = {
    token,
    userState,
    getUserState,
    setLogin,
    setLogout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
