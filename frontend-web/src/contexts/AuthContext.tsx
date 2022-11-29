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

  const handleLogin = data => {
    setToken(data);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUserState(initUserState);
    navigate('/login');
  };

  const handleRefresh = () => {
    authService
      .refreshAccessToken()
      .then(response => {
        // console.log(response);
        if (response.status === 201) {
          setToken(response?.data?.accessToken);
          return response?.data?.accessToken;
        }
      })
      .catch(error => {
        console.log(error);
        navigate('/login');
      });
  };

  const getUserState = async () => {
    if (token) {
      await authService
        .getUserInfo()
        .then(response => {
          if (response.status === 200) {
            setUserState({ userId: response.data.data.user_id, userEmail: response.data.data.email });
            // console.log(userState, '유저정보');
          }
        })
        .catch(error => {
          // navigate('/login');
          console.log(error);
        });
    }
  };

  const value = {
    token,
    userState,
    getUserState,
    onLogin: handleLogin,
    onLogout: handleLogout,
    onRefresh: handleRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
