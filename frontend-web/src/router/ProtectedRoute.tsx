import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useNavigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();

  useAuthAxios();

  useEffect(() => {
    showLoading();
    getUserState()
      .catch(() => {
        navigate('/login', { replace: true });
      })
      .finally(() => {
        hideLoading();
      });
  }, []);

  if (token) {
    return children;
  }
};
