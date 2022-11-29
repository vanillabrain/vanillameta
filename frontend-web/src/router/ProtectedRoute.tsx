import React, { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState, onRefresh } = useContext(AuthContext);
  useAuthAxios();

  useEffect(() => {
    onRefresh();
  }, []);

  useEffect(() => {
    getUserState();
  }, [token]);

  console.log('token:', token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
