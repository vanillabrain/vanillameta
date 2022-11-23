import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Paper } from '@mui/material';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import Copyright from '@/components/Copyright';
import authService from '@/api/authService';

const SignUp = () => {
  const { isLogin, checkLogin } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const [userInfo] = useState({
    userId: '',
    userPwd: '',
    userEmail: '',
  });
  let isValidate;

  useEffect(() => {
    showLoading();
    checkLogin();
    console.log('Login', isLogin);
    if (isLogin) {
      navigate('/dashboard');
    }
    hideLoading();
  }, [isLogin]);

  const handleSignup = async event => {
    event.preventDefault();
    showLoading();
    const data = {
      user_id: event.target.userId.value,
      password: event.target.userPwd.value,
      email: event.target.userEmail.value,
    };
    await validateData(data);
    if (isValidate) {
      await authService
        .signup(data)
        .then(res => {
          console.log(res);
          if (res) {
            alert.success(`${event.target.userId.value}님\n회원가입이 완료되었습니다.`);
            navigate('/login');
          }
        })
        .catch(error => {
          alert.error(error.message);
        })
        .finally(() => {
          hideLoading();
        });
    } else {
      console.log('error');
    }
    hideLoading();
  };

  const validateData = ({ user_id, password, email }) => {
    console.log('user_id:', user_id, 'password:', password, 'email:', email, isValidate);
    if (user_id && password && email) {
      isValidate = true;
    }
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
        <Paper
          elevation={0}
          sx={{ width: '560px', mt: '32px', px: '100px', pt: '60px', pb: '80px', border: 'solid 1px #e2e2e2' }}
        >
          <Stack component="form" onSubmit={handleSignup} noValidate sx={{ width: '360px' }} spacing="20px">
            <Typography sx={{ mb: '36px', fontSize: '24px', fontWeight: 600, lineHeight: 1.33, color: '#141414' }}>
              <Box component="span" sx={{ color: '#0f5ab2' }}>
                회원가입
              </Box>
              후<br /> 편리하게 이용하세요.
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              id="userId"
              label="User ID"
              name="userId"
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
            <TextField
              margin="normal"
              required
              fullWidth
              name="userEmail"
              defaultValue={userInfo.userEmail}
              label="E-mail"
              type="email"
              id="email"
              sx={{ height: '36px' }}
            />
            <Button type="submit" size="large" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
              가입하기
            </Button>
          </Stack>
          <Typography
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              mt: '50px',
              fontSize: '14px',
              textAlign: 'center',
              color: '#4a4a4a',
            }}
          >
            <Box
              component={RouterLink}
              to="/login"
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                color: 'inherit',

                '&:after': {
                  content: `""`,
                  width: '1px',
                  height: '10px',
                  backgroundColor: '#cccfd8',
                },
              }}
            >
              로그인
            </Box>
            <Box>아이디/비번찾기</Box>
          </Typography>
        </Paper>
      </Box>
      <Copyright sx={{ mt: '40px' }} />
    </Box>
  );
};

export default SignUp;
