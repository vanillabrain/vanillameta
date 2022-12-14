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
      .catch(error => {
        // refresh token 만료
        console.log(error);
        if (error.response.status === 401) {
          alert.error('로그인이 만료되었습니다.\n다시 로그인 해주세요.', {
            onClose: () => {
              navigate('/login', { replace: true });
            },
          });
        } else {
          alert.error('문제가 발생했습니다.\n잠시 후에 다시 시도해 주세요.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  }, [token]);

  if (token) {
    return children;
  }
};
