import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import authService from '@/api/authService';
import { LoadingContext } from '@/contexts/LoadingContext';
import { removeToken } from '@/helpers/authHelper';
import { cn } from '@/lib/utils';

const Logout = props => {
  const { className, ...rest } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const { t } = useTranslation();

  const handleLogout = () => {
    alert.success(t('user.logoutConfirm'), {
      closeCopy: t('dataRecommend.cancel'),
      actions: [
        {
          copy: t('user.confirm'),
          onClick: () => {
            showLoading();
            authService
              .signout()
              .then(response => {
                if (response.status === 201) {
                  removeToken();
                  navigate('/login');
                }
              })
              .catch(error => {
                console.log(error);
                if (error.response.status === 401) {
                  // 이미 accessToken이 만료
                  removeToken();
                  navigate('/login');
                } else {
                  alert.error(t('user.logoutFailed'));
                }
              })
              .finally(() => {
                hideLoading();
              });
          },
        },
      ],
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleLogout}
      className={cn('px-2 font-normal text-inherit whitespace-nowrap hover:bg-transparent hover:text-inherit', className)}
      {...rest}
    >
      {t('user.logout')}
    </Button>
  );
};

export default Logout;
