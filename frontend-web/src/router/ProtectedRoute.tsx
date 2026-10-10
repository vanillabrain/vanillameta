import { useTranslation } from 'react-i18next';
import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useNavigate } from 'react-router-dom';
import { getToken, removeToken } from '@/helpers/authHelper';
import { useAlert } from 'react-alert';

export const ProtectedRoute = ({ children }) => {
  const { t } = useTranslation();
  const { getUserState } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const token = getToken();

  useEffect(() => {
    if (token) {
      showLoading();
      getUserState()
        .catch(error => {
          // refresh token 만료
          console.log(error);
          if (error.response.status === 401) {
            alert.error(t('profile.expired'), {
              onClose: () => {
                removeToken();
                navigate('/login', { replace: true });
              },
            });
          } else {
            alert.error(t('common.genericError'));
          }
        })
        .finally(() => {
          hideLoading();
        });
    } else {
      navigate('/login', { replace: true });
    }
  }, [token]);

  if (token) {
    return children;
  }
};
