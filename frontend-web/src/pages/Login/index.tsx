import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import backgroundImage from '@/assets/images/visual-bg.png';
import { useCookies } from 'react-cookie';

function Copyright(props: any) {
  return (
    <Typography color="text.secondary" align="center" {...props}>
      <Link
        color="inherit"
        href="https://vanillabrain.com/"
        sx={{ fontSize: '13px', color: '#767676', textDecoration: 'none' }}
      >
        @ Vanilla Meta 2022
      </Link>
      {/*{' '}*/}
      {/*{new Date().getFullYear()}*/}
      {/*{'.'}*/}
    </Typography>
  );
}

const Login = () => {
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [userInfo] = useState({
    userId: process.env.REACT_APP_MODE === 'local' ? process.env.REACT_APP_ID : '',
    userPwd: process.env.REACT_APP_MODE === 'local' ? process.env.REACT_APP_PWD : '',
  });
  const [cookies, setCookie, removeCookie] = useCookies(['rememberEmailId']);
  const [isRemember, setIsRemember] = useState(false);

  const handleLogin = async event => {
    event.preventDefault();
    showLoading();
    // saveIdInCookie();
    await onLogin(event.target.userId.value, event.target.userPwd.value)
      .then(res => {
        if (res) {
          navigate('/dashboard');
        }
      })
      .catch(error => {
        alert.error(error.message);
      })
      .finally(() => {
        hideLoading();
      });
  };

  const saveIdInCookie = () => {
    const emailId = userInfo.userId;
    if (isRemember) {
      setCookie('rememberEmailId', emailId, { maxAge: 2000 });
    } else {
      removeCookie('rememberEmailId');
    }
  };

  return (
    <Box
      component="main"
      sx={{ position: 'relative', zIndex: 0, width: '100%', height: '100%', minWidth: '100%', backgroundColor: '#f5f6f8' }}
    >
      <Box
        sx={{
          pt: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Logo width="223px" height="43px" />

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
