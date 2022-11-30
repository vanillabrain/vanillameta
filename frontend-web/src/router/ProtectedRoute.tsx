import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useAuthAxios from '@/hooks/useAuthAxios';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useNavigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }) => {
  const { token, getUserState, onRefresh } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();

  useAuthAxios();
  useEffect(() => {
    if (!token) {
      showLoading();
      onRefresh()
        .catch(error => {
          console.log(error);
          navigate('/login');
        })
        .finally(() => {
          hideLoading();
        });
    }
  }, []);

  useEffect(() => {
    showLoading();
    getUserState().finally(() => {
      hideLoading();
    });
  }, [token]);

  // console.log('token:', token);

  if (token) {
    return children;
  }
};
