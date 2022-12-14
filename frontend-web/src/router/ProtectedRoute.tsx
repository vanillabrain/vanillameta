import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useNavigate } from 'react-router-dom';
import { getToken } from '@/helpers/authHelper';
import { useAlert } from 'react-alert';

export const ProtectedRoute = ({ children }) => {
  const { getUserState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const token = getToken();

  useEffect(() => {
    showLoading();
    getUserState()
      .catch(() => {
        // refresh token 만료
        alert.error('로그인이 만료되었습니다.\n다시 로그인 해주세요.', {
          onClose: () => {
            navigate('/login', { replace: true });
          },
        });
      })
      .finally(() => {
        hideLoading();
      });
  }, [token]);

  if (token) {
    return children;
  }
};
