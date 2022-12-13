import React, { useContext } from 'react';
import { Button } from '@mui/material';
import authService from '@/api/authService';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { AuthContext } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const { setLogout } = useContext(AuthContext);
  const navigate = useNavigate();
  const alert = useAlert();

  const handleLogout = () => {
    alert.success('로그아웃 하시겠습니까?', {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            showLoading();
            authService
              .signout()
              .then(response => {
                if (response.status === 201) {
                  setLogout();
                  navigate('/login');
                }
              })
              .catch(error => {
                console.log(error);
                if (error.response.status === 401) {
                  // 이미 refreshToken이 만료
                  setLogout();
                  alert.success('이미 로그아웃 되었습니다.', {
                    onClose: () => {
                      setLogout();
                      navigate('/login');
                    },
                  });
                } else {
                  alert.error('로그아웃에 실패했습니다.\n다시 시도해 주세요.');
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
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 0,
        minHeight: 0,
        m: 0,
        p: 0,
        gap: '12px',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        textDecoration: 'underline',
        color: 'inherit',
        '&:hover': {
          textDecoration: 'underline',
          backgroundColor: 'inherit',
        },

        '&:after': {
          content: `""`,
          width: '1px',
          height: '10px',
          backgroundColor: '#cccfd8',
        },
      }}
    >
      로그아웃
    </Button>
  );
};

export default Logout;
