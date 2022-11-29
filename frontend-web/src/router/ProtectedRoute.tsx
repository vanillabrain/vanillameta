import React, { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { LoadingContext } from '@/contexts/LoadingContext';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState, onRefresh } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useAuthAxios();
  useEffect(() => {
    if (!token) {
      showLoading();
      onRefresh();
      hideLoading();
    }
  }, []);

  useEffect(() => {
    showLoading();
    getUserState();
    hideLoading();
  }, [token]);

  console.log('token:', token);

  if (token) {
    return children;
  }
};
