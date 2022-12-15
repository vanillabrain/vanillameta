import { createContext, useState } from 'react';
import authService from '@/api/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const initUserState = {
    userId: null,
    userEmail: null,
  };
  const [userState, setUserState] = useState(initUserState);

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
    userState,
    getUserState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
