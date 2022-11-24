import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Paper } from '@mui/material';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import Copyright from '@/components/Copyright';
import authService from '@/api/authService';
import { SnackbarContext } from '@/contexts/AlertContext';

const SignUp = () => {
  const { isLogin, checkLogin } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [userInfo] = useState({
    userId: '',
    userPwd: '',
    userEmail: '',
  });
  let isValid;

  useEffect(() => {
    showLoading();
    // checkLogin();
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
    isValid = true;
    if (isValid) {
      await authService
        .signup(data)
        .then(res => {
          console.log(res, 'res');
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
    if (!user_id || !password || !email) {
      snackbar.error('입력란을 모두 작성해 주세요.');
      return;
    } else {
      if (user_id.length >= 20) {
        snackbar.error('ID는 20글자 이내로 작성해 주세요.');
        return;
      }
      if (password.length <= 8) {
        snackbar.error('비밀번호는 8글자 이상이며 숫자와 대문자, 특수문자가 포함되어 있어야 합니다.');
        return;
      }
      const checkPwd = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/;
      if (!checkPwd.test(password)) {
        snackbar.error('비밀번호는 8글자 이상이며 숫자와 영문 대소문자, 특수문자가 포함되어 있어야 합니다.');
        return;
      }
      const checkEmail = /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/;
      if (!checkEmail.test(email)) {
        snackbar.error('E-mail의 형식이 맞는지 확인해 주세요.');
        return;
      }
      console.log('user_id:', user_id, 'password:', password, 'email:', email);
      isValid = true;
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
            component="div"
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