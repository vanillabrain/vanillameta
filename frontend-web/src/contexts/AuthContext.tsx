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

  const refreshToken = (): Promise<any> =>
    new Promise((resolve, reject) => {
      authService
        .refreshAccessToken()
        .then(response => {
          if (response.status === 201) {
            console.log('refresh token success!');
            setToken(response.data.accessToken);
          }
          return resolve(response);
        })
        .catch(error => {
          console.log(error, 'refresh token error');
          return reject(error);
        });
    });

  const getUserState = (): Promise<any> =>
    new Promise((resolve, reject) => {
      authService
        .getUserInfo()
        .then(response => {
          if (response.status === 200) {
            setUserState({ userId: response.data.data.userId, userEmail: response.data.data.email });
          }
          return resolve(response);
        })
        .catch(error => {
          console.log(error);
          return reject(error);
        });
    });

  const value = {
    token,
    setToken,
    userState,
    getUserState,
    setLogin,
    setLogout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
