import { Navigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { useContext, useEffect } from 'react';
import { LoadingContext } from '@/contexts/LoadingContext';

export const ProtectedRoute = ({ children }) => {
  const { isLogin, checkLogin } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useEffect(() => {
    showLoading();
    checkLogin();
    console.log('ProtectedRoute', isLogin);
  }, [isLogin]);

  if (!isLogin) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
