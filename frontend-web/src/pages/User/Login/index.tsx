import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import backgroundImage from '@/assets/images/visual-bg.png';
import Copyright from '@/components/Copyright';
import authService from '@/api/authService';

const Login = () => {
  const { token, onLogin } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const [userInfo, setUserInfo] = useState({
    userId: '',
    userPwd: '',
  });

  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token]);

  const handleChange = event => {
    event.preventDefault();
    setUserInfo(prevState => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleLogin = async event => {
    event.preventDefault();
    showLoading();
    const data = {
      user_id: userInfo.userId,
      password: userInfo.userPwd,
    };
    await authService
      .signin(data)
      .then(response => {
        if (response.status === 201) {
          onLogin(response.data.accessToken);
        }
      })
      .catch(error => {
        console.log(error);
        alert.error('ID 또는 비밀번호가 일치하지 않습니다.');
      })
      .finally(() => {
        hideLoading();
      });
  };

  return (
    <Box
      component="main"
      sx={{ position: 'relative', zIndex: 0, width: '100%', height: '100%', minWidth: '100vw', backgroundColor: '#f5f6f8' }}
    >
      <Box
        sx={{
          pt: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <RouterLink to="/">
          <Logo width="223px" height="43px" />
        </RouterLink>
        <Typography sx={{ mt: '17px', fontSize: '16px', color: '#043f84' }}>
          통합 데이터분석을 위한{' '}
          <Typography component="span" sx={{ fontSize: '16px', fontWeight: 'bold' }}>
            대시보드 리포팅 솔루션
          </Typography>
        </Typography>
        <Stack component="form" onSubmit={handleLogin} noValidate sx={{ width: '360px', mt: '56px' }} spacing="20px">
          <TextField
            label="User ID"
            name="userId"
            value={userInfo.userId}
            onChange={handleChange}
            margin="normal"
            required={true}
            fullWidth
          />
          <TextField
            label="Password"
            name="userPwd"
            value={userInfo.userPwd}
            onChange={handleChange}
            type="password"
            margin="normal"
            required={true}
            fullWidth
            sx={{ height: '36px' }}
          />
          <Button type="submit" size="large" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
            Login
          </Button>
        </Stack>
        <Stack
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            mt: '40px',
            fontSize: '14px',
            textAlign: 'center',
            color: '#4a4a4a',
          }}
        >
          <Button
            component={RouterLink}
            to="/signup"
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
            회원가입
          </Button>
          <Button
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
              // textDecoration: 'underline',
              color: 'inherit',
              '&:hover': {
                // textDecoration: 'underline',
                backgroundColor: 'inherit',
              },
            }}
          >
            아이디/비번찾기
          </Button>
        </Stack>
      </Box>
      <Copyright sx={{ mt: '50px', mb: 4 }} />
      <Box
        component="img"
        src={backgroundImage}
        sx={{
          position: 'fixed',
          zIndex: -1,
          bottom: 0,
          left: 0,
          right: 0,
          margin: 'auto',
          width: '1024px',
          height: '508px',
        }}
      />
    </Box>
  );
};

export default Login;
