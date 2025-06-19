import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { LoadingContext } from '@/contexts/LoadingContext';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import backgroundImage from '@/assets/images/visual-bg.png';
import { Copyright } from '@/layouts/Footer';
import authService from '@/api/authService';
import { checkId, checkPwd } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import { getToken, setToken } from '@/helpers/authHelper';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Login = () => {
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { t } = useTranslation(['auth', 'common']);
  const [userInfo, setUserInfo] = useState({
    userId: '',
    userPwd: '',
  });
  let isValid;
  const token = getToken();
  const APP_MODE = process.env.REACT_APP_MODE;

  useEffect(() => {
    console.log('APP_MODE', APP_MODE);
    if (token) {
      // token이 있으면 대시보드로 보내기
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

  const handleLogin = event => {
    event.preventDefault();
    showLoading();
    validateData();
    if (isValid) {
      const data = {
        userId: userInfo.userId,
        password: userInfo.userPwd,
      };
      authService
        .signin(data)
        .then(response => {
          if (response.status === 201) {
            setToken(response.data.accessToken);
            navigate('/dashboard');
          }
        })
        .catch(error => {
          console.log(error);
          if (error.response.status === 401) {
            snackbar.error(t('auth:login.invalidCredentials'));
            return;
          }
          alert.error(t('auth:login.failed'));
        })
        .finally(() => {
          hideLoading();
        });
    }
    hideLoading();
  };

  const validateData = () => {
    const { userId, userPwd } = userInfo;
    // console.log('userId:', userId, 'userFirstPwd:', userFirstPwd, 'userSecondPwd:', userSecondPwd, 'userEmail:', userEmail);
    if (!userId || !userPwd) {
      snackbar.error(t('common:messages.required'));
      return;
    } else {
      if (userId.length < 5 || userId.length >= 20) {
        snackbar.error(t('common:validation.minLength', { field: t('auth:login.userId'), min: 5 }));
        return;
      }
      if (!checkId.test(userId)) {
        snackbar.error(t('common:validation.pattern'));
        return;
      }
      if (!checkPwd.test(userPwd)) {
        snackbar.error(t('common:validation.pattern'));
        return;
      }
      isValid = true;
    }
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
        <Seo title={t('auth:login.title')} />
        <Box
          sx={{
            pt: '90px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <RouterLink to="/">
              <Logo width="223px" height="43px" />
            </RouterLink>
            <Box sx={{ position: 'absolute', top: 0, right: -50 }}>
              <LanguageSwitcher />
            </Box>
          </Box>
          <Typography sx={{ mt: '17px', fontSize: '16px', color: '#043f84', textAlign: 'center' }}>
            {t('common:app.description')}
          </Typography>
          <Stack
            component="form"
            onSubmit={handleLogin}
            noValidate
            sx={{ width: { xs: 'calc(100% - 40px)', sm: '360px' }, mt: '56px' }}
            spacing="20px"
          >
            <TextField
              autoFocus={true}
              label={t('auth:login.userId')}
              name="userId"
              value={userInfo.userId}
              onChange={handleChange}
              margin="normal"
              required={true}
              fullWidth
              sx={{ height: { xs: '44px', sm: '36px' } }}
              InputLabelProps={{ sx: { pt: { xs: '6px', sm: 0 } } }}
              InputProps={{
                sx: { height: { xs: '44px', sm: '36px' }, input: { padding: '12px 14px' } },
              }}
            />
            <TextField
              label={t('auth:login.password')}
              name="userPwd"
              value={userInfo.userPwd}
              onChange={handleChange}
              type="password"
              margin="normal"
              required={true}
              fullWidth
              sx={{ height: { xs: '44px', sm: '36px' } }}
              InputLabelProps={{ sx: { pt: { xs: '6px', sm: 0 } } }}
              InputProps={{
                sx: { height: { xs: '44px', sm: '36px' }, input: { padding: '12px 14px' } },
              }}
            />
            <Button
              type="submit"
              size="large"
              fullWidth
              variant="contained"
              sx={{ height: { xs: '50px', sm: '44px' }, mt: 3, mb: 2 }}
            >
              {t('auth:login.signIn')}
            </Button>
          </Stack>
          {APP_MODE != 'prod' && (
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
                {t('auth:login.signUp')}
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
                {t('auth:login.forgotPassword')}
              </Button>
            </Stack>
          )}
        </Box>
        <Copyright sx={{ mt: '50px', mb: 4 }} />
        <Box
          component="img"
          src={backgroundImage}
          sx={{
            position: 'fixed',
            zIndex: -1,
            bottom: 0,
            left: '50%',
            margin: 'auto',
            width: '1024px',
            height: '508px',
            transform: 'translateX(-50%)',
          }}
        />
      </Box>
    );
  }
};

export default Login;
