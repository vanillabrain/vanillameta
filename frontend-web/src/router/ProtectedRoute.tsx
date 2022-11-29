import React, { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { LoadingContext } from '@/contexts/LoadingContext';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState, onRefresh } = useContext(AuthContext);
  const { showLoading } = useContext(LoadingContext);

  useAuthAxios();
  useEffect(() => {
    if (!token) {
      onRefresh();
    }
  }, []);

  useEffect(() => {
    getUserState();
  }, [token]);

  console.log('token:', token);

  return token ? children : showLoading();
};
