import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import authService from '@/api/authService';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '@/helpers/authHelper';

const Logout = props => {
  const { sx } = props;
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
      onClick={handleLogout}
      disableRipple
      disableFocusRipple
      disableTouchRipple
      sx={{
        minWidth: 0,
        minHeight: 0,
        m: 0,
        p: 0,
        fontSize: 'inherit',
        fontWeight: 'inherit',
        color: 'inherit',
        whiteSpace: 'nowrap',
        '&:hover': {
          backgroundColor: 'inherit',
        },
        ...sx,
      }}
    >
      {t('user.logout')}
    </Button>
  );
};

export default Logout;
