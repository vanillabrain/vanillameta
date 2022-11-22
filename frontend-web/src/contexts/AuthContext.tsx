import { createContext, useContext, useState } from 'react';
import authService from '@/api/authService';
import axios from 'axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // const [token, setToken] = useState(null);
  const [isLogin, setIsLogin] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // const storage = window.sessionStorage;
  //
  // const handleLogin = async (id, pwd) => {
  //   return new Promise((resolve, reject) => {
  //     if (id === process.env.REACT_APP_ID && pwd === process.env.REACT_APP_PWD) {
  //       setToken(process.env.REACT_APP_TOKEN);
  //       storage.setItem('loggedUserId', id);
  //       storage.setItem('loggedUserPwd', pwd);
  //       setTimeout(() => resolve(process.env.REACT_APP_TOKEN), 1000);
  //     } else {
  //       reject(new Error('ID 또는 비밀번호가 일치하지 않습니다.'));
  //     }
  //   });
  // };

  const handleCheckLogin = async () => {
    return await axios.get('/data/dummyUser.json').then(response => {
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

  const handleSubmitLogin = async (id, pwd) => {
    // return new Promise((resolve, reject) => {
    //   if (id === process.env.REACT_APP_ID && pwd === process.env.REACT_APP_PWD) {
    //     setToken(process.env.REACT_APP_TOKEN);
    //     setTimeout(() => resolve(process.env.REACT_APP_TOKEN), 1000);
    //   } else {
    //     reject(new Error('User ID or password incorrect.'));
    //   }
    // });
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
        }
      })
      .catch(error => {
        setIsLogin(false);
        console.log(error, error.response.data.data.message);
        throw error;
      });
  };

  const handleLogout = () => {
    // setToken(null);
    setIsLogin(false);
  };

  const value = {
    isLogin,
    userInfo,
    checkLogin: handleCheckLogin,
    onLogin: handleSubmitLogin,
    onLogout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
