import { createContext, useState } from 'react';
import authService from '@/api/authService';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const initUserState = {
    isLogin: false,
    userId: null,
    userEmail: null,
  };
  const [userState, setUserState] = useState(initUserState);

  const handleLogout = async () => {
    authService
      .signout()
      .then(response => {
        if (response.statue === 200) {
          setToken(null);
          setUserState(initUserState);
          navigate('/login');
        }
      })
      .catch(error => {
        console.log(error);
      });
  };

  const handleRefresh = () => {
    authService.refreshAccessToken().then(response => {
      // console.log(response);
      if (response.status === 201) {
        setToken(response?.data?.accessToken);
        setUserState(initUserState);
        return response?.data?.accessToken;
      }
    });
    // .catch(error => {
    //   console.log(error);
    // });
  };

  const getUserState = () => {
    if (token) {
      authService
        .getUser()
        .then(response => {
          // console.log(response);
          if (response.status === 200) {
            setUserState({ isLogin: true, userId: response.data.data.user_id, userEmail: response.data.data.email });
            // console.log(userState, '유저정보');
          }
        })
        .catch(error => {
          navigate('/login');
          console.log(error);
        });
    }
  };

  const value = {
    token,
    setToken,
    userState,
    getUserState,
    // onLogin: handleLogin,
    // onLogout: handleLogout,
    onRefresh: handleRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
