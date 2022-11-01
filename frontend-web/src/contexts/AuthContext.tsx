import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);

  const handleLogin = async (id, pwd) => {
    return new Promise((resolve, reject) => {
      if (id === process.env.REACT_APP_ID && pwd === process.env.REACT_APP_PWD) {
        setToken(process.env.REACT_APP_TOKEN);
        setTimeout(() => resolve(process.env.REACT_APP_TOKEN), 1000);
      } else {
        reject(new Error('User ID or password incorrect.'));
      }
    });
  };

  const handleLogout = () => {
    setToken(null);
  };

  const value = {
    token,
    onLogin: handleLogin,
    onLogout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
