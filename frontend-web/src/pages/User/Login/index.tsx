import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import backgroundImage from '@/assets/images/visual-bg.png';
import Copyright from '@/components/Copyright';

const Login = () => {
  const { isLogin, onLogin, checkLogin } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const [userInfo] = useState({
    userId: '',
    userPwd: '',
  });

  useEffect(() => {
    showLoading();
    // checkLogin();
    console.log('Login', isLogin);
    if (isLogin) {
      navigate('/dashboard');
    }
    hideLoading();
  }, [isLogin]);

  const handleLogin = async event => {
    event.preventDefault();
    showLoading();
    await onLogin(event.target.userId.value, event.target.userPwd.value)
      .then(res => {
        if (res) {
          navigate('/dashboard');
        }
      })
      .catch(() => {
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
            margin="normal"
            required
            fullWidth
            id="userId"
            label="User ID"
            name="email"
            defaultValue={userInfo.userId}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="userPwd"
            defaultValue={userInfo.userPwd}
            label="Password"
            type="password"
            id="password"
            sx={{ height: '36px' }}
          />
          {/*<FormControlLabel control={<Checkbox value="remember" color="primary" />} label="Remember me" />*/}
          <Button type="submit" size="large" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
            Login
          </Button>
        </Stack>
        <Typography
          sx={{ display: 'block', mt: '50px', fontSize: '14px', textAlign: 'center', color: '#4a4a4a' }}
          component={RouterLink}
          to="/signup"
        >
          회원가입
        </Typography>
      </Box>
      <Copyright sx={{ mt: 8, mb: 4 }} />
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
          height: '608px',
        }}
      />
    </Box>
  );
};

export default Login;
