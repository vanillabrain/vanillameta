import { createContext, useContext, useState } from 'react';
import authService from '@/api/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const storage = window.sessionStorage;

  const handleLogin = async (id, pwd) => {
    return new Promise((resolve, reject) => {
      if (id === process.env.REACT_APP_ID && pwd === process.env.REACT_APP_PWD) {
        setToken(process.env.REACT_APP_TOKEN);
        storage.setItem('loggedUserId', id);
        storage.setItem('loggedUserPwd', pwd);
        setTimeout(() => resolve(process.env.REACT_APP_TOKEN), 1000);
      } else {
        reject(new Error('ID 또는 비밀번호가 일치하지 않습니다.'));
      }
    });
  };

  const handleSubmitLogin = async data => {
    return authService.login(data).then(res => {
      console.log(res);
    });
  };

  const handleLogout = () => {
    setToken(null);
  };

  const value = {
    token,
    onLogin: handleSubmitLogin,
    onLogout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
