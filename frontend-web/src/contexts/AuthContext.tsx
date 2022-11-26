import { createContext, useState } from 'react';
import authService from '@/api/authService';
import { removeToken, setToken } from '@/helpers/authHelper';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // const [accessToken, setAccessToken] = useState(null);
  const navigate = useNavigate();
  const [userState, setUserState] = useState({
    isLogin: false,
    userId: null,
    userEmail: null,
  });

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
          console.log(response.data.accessToken);
          setToken(response.data.accessToken);
          navigate('/dashboard');
          // setAccessToken(response.data.accessToken);
        }
      })
      .catch(error => {
        removeToken();
        // setAccessToken(null);
        console.log(error, error.response.data.data.message);
        throw error;
      });
  };

  const handleLogout = () => {
    removeToken();
  };

  const value = {
    userState,
    setUserState,
    onLogin: handleLogin,
    onLogout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
