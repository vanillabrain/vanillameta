import React, { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';

export const ProtectedRoute = ({ children }) => {
  const { userState, getUserState } = useContext(AuthContext);

  useAuthAxios();
  useEffect(() => {
    getUserState();
  }, []);

  console.log('isLogin:', userState?.isLogin);

  // if (!userState?.isLogin) {
  //   return <Navigate to="/login" replace />;
  // }

  return children;
};
