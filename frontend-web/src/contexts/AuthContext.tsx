import { createContext, useContext, useState } from 'react';
import authService from '@/api/authService';
import axios from 'axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLogin, setIsLogin] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const handleCheckLogin = async () => {
    return await axios.get('/data/dummyUser2.json').then(response => {
      if (response.status === 200) {
        console.log(response);
        setIsLogin(true);
        setUserInfo(response.data.data);
        console.log(isLogin, userInfo);
      }
    });
    // return authService.getUser().then(response => {
    //   if (response.status === 200) {
    //     setIsLogin(true);
    //     setUserInfo(response.data);
    //   }
    // });
  };

  const handleLogin = async (id, pwd) => {
    const data = {
      user_id: id,
      password: pwd,
    };
    return authService
      .login(data)
      .then(response => {
        console.log(response, 'response');
        if (response.status === 201) {
          setIsLogin(true);
          setAccessToken(response.data.accessToken);
        }
      })
      .catch(error => {
        setIsLogin(false);
        console.log(error, error.response.data.data.message);
        throw error;
      });
  };

  const handleLogout = () => {
    setIsLogin(false);
  };

  const value = {
    isLogin,
    userInfo,
    token: accessToken,
    // checkLogin: handleCheckLogin,
    onLogin: handleLogin,
    onLogout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
