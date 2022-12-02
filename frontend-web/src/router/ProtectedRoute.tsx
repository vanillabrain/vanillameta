import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { LoadingContext } from '@/contexts/LoadingContext';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useAuthAxios();

  useEffect(() => {
    showLoading();
    getUserState().finally(() => {
      hideLoading();
    });
  }, [token]);

  if (token) {
    return children;
  }
};
