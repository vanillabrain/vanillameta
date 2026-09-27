import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import Logo from '@/assets/images/logo.svg?react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { Copyright } from '@/layouts/Footer';
import authService from '@/api/authService';
import { SnackbarContext } from '@/contexts/AlertContext';
import { checkEmail, checkId, checkPwd } from '@/utils/util';
import Seo from '@/seo/Seo';
import { getToken } from '@/helpers/authHelper';

const SignUp = () => {
  const { t } = useTranslation();
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
            alert.success(t('signup.welcome', { name: event.target.userId.value }));
            navigate('/login');
          }
        })
        .catch(error => {
          console.log(error);
          if (error.response.status === 409 && error.response.data.data === 'conflict userId') {
            snackbar.error(t('signup.dupId'));
          } else if (error.response.status === 409 && error.response.data.data === 'conflict email') {
            snackbar.error(t('signup.dupEmail'));
          } else {
            alert.error(t('signup.failed'));
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
      snackbar.error(t('login.fillAll'));
      return;
    } else {
      if (userId.length < 5 || userId.length >= 20) {
        snackbar.error(t('login.idLength'));
        return;
      }
      if (!checkId.test(userId)) {
        snackbar.error(t('login.idFormat'));
        return;
      }
      if (!checkPwd.test(userPwd)) {
        snackbar.error(t('login.pwdFormat'));
        return;
      }
      if (userPwd !== userConfirmPwd) {
        snackbar.error(t('signup.pwdMismatch'));
        return;
      }
      if (!checkEmail.test(userEmail)) {
        snackbar.error(t('signup.emailFormat'));
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
        <Seo title={t('signup.title')} />
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
                  {t('signup.taglineA')}
                </Box>
                {t('signup.taglineB')}
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
                {t('signup.submit')}
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
                {t('login.title')}
              </Box>
              <Box>{t('login.findAccount')}</Box>
            </Typography>
          </Paper>
        </Box>
        <Copyright sx={{ mt: '40px' }} />
      </Box>
    );
  }
};

export default SignUp;
