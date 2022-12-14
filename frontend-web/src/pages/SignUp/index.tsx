import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import Copyright from '@/components/Copyright';
import authService from '@/api/authService';
import { SnackbarContext } from '@/contexts/AlertContext';
import { checkEmail, checkId, checkPwd } from '@/utils/util';
import Seo from '@/seo/Seo';
import { getToken } from '@/helpers/authHelper';

const SignUp = () => {
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [userInfo, setUserInfo] = useState({
    userId: '',
    userPwd: '',
    userConfirmPwd: '',
    userEmail: '',
  });
  const token = getToken();
  let isValid;

  useEffect(() => {
    if (token) {
      // token이 있으면 대시보드로 보내기
      navigate('/dashboard');
    }
  }, []);

  const handleSignup = event => {
    event.preventDefault();
    showLoading();
    validateData();
    if (isValid) {
      const data = {
        userId: userInfo.userId,
        password: userInfo.userPwd,
        email: userInfo.userEmail,
      };
      authService
        .signup(data)
        .then(response => {
          // console.log(response);
          if (response.status === 201) {
            alert.success(`${event.target.userId.value}님\n회원가입이 완료되었습니다.`);
            navigate('/login');
          }
        })
        .catch(error => {
          console.log(error);
          if (error.response.status === 409 && error.response.data.data === 'conflict userId') {
            snackbar.error('이미 가입된 ID입니다.');
          } else if (error.response.status === 409 && error.response.data.data === 'conflict email') {
            snackbar.error('이미 가입된 E-mail입니다.');
          } else {
            alert.error('회원가입에 실패했습니다.\n다시 시도해 주세요.');
          }
        })
        .finally(() => {
          hideLoading();
        });
    }
    hideLoading();
  };

  const validateData = () => {
    const { userId, userPwd, userConfirmPwd, userEmail } = userInfo;
    // console.log('userId:', userId, 'userPwd:', userPwd, 'userConfirmPwd:', userConfirmPwd, 'userEmail:', userEmail);
    if (!userId || !userPwd || !userConfirmPwd || !userEmail) {
      snackbar.error('입력란을 모두 작성해 주세요.');
      return;
    } else {
      if (userId.length < 5 || userId.length >= 20) {
        snackbar.error('ID는 5글자에서 20글자 이내로 작성해 주세요.');
        return;
      }
      if (!checkId.test(userId)) {
        snackbar.error('ID는 공백 없는 영문, 숫자만 가능합니다.');
        return;
      }
      if (!checkPwd.test(userPwd)) {
        snackbar.error('비밀번호는 8글자 이상이며 숫자와 영문 대소문자, 특수문자가 포함되어 있어야 합니다.');
        return;
      }
      if (userPwd !== userConfirmPwd) {
        snackbar.error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      if (!checkEmail.test(userEmail)) {
        snackbar.error('E-mail의 형식이 맞는지 확인해 주세요.');
        return;
      }
      isValid = true;
    }
  };

  const handleChange = event => {
    event.preventDefault();
    setUserInfo(prevState => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  if (!token) {
    return (
      <Box
        component="main"
        sx={{
          position: 'relative',
          zIndex: 0,
          width: '100%',
          height: '100%',
          minWidth: '100vw',
          backgroundColor: '#f5f6f8',
        }}
      >
        <Seo title="회원가입" />
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
                label="User ID"
                name="userId"
                type="text"
                value={userInfo.userId}
                onChange={handleChange}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="userPwd"
                value={userInfo.userPwd}
                onChange={handleChange}
                label="Password"
                type="password"
                sx={{ height: '36px' }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="userConfirmPwd"
                value={userInfo.userConfirmPwd}
                onChange={handleChange}
                label="Confirm Password"
                type="password"
                sx={{ height: '36px' }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="userEmail"
                value={userInfo.userEmail}
                onChange={handleChange}
                label="E-mail"
                type="email"
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
  }
};

export default SignUp;
