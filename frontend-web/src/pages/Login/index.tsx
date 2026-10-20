import { reuseReturn } from '@/helpers/reuseReturn';
import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { LoadingContext } from '@/contexts/LoadingContext';
import Logo from '@/assets/images/logo.svg?react';
import backgroundImage from '@/assets/images/visual-bg.png';
import { Copyright } from '@/layouts/Footer';
import authService from '@/api/authService';
import { checkId, checkPwd } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import { getToken, setToken } from '@/helpers/authHelper';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';

const Login = () => {
  const { t } = useTranslation();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const { search } = useLocation();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [userInfo, setUserInfo] = useState({
    userId: '',
    userPwd: '',
  });
  let isValid;
  const token = getToken();
  const APP_MODE = import.meta.env.REACT_APP_MODE;

  useEffect(() => {
    console.log('APP_MODE', APP_MODE);
    if (token) {
      // token이 있으면 대시보드로 보내기
      navigate(reuseReturn(search));
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
            navigate(reuseReturn(search));
          }
        })
        .catch(error => {
          console.log(error);
          if (error.response.status === 401) {
            snackbar.error(t('login.mismatch'));
            return;
          }
          alert.error(t('login.failed'));
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
      isValid = true;
    }
  };

  if (!token) {
    return (
      <main className="relative isolate min-h-full w-full overflow-hidden bg-muted px-4 pb-8">
        <Seo title={t('login.title')} />
        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center pt-12 sm:pt-16">
          <RouterLink to="/">
            <Logo width="223px" height="43px" aria-label="VanillaMeta" />
          </RouterLink>
          <p className="mt-4 max-w-sm text-center text-sm leading-6 text-muted-foreground">
            {t('login.taglineA')}
            <span className="text-sm font-semibold">{t('login.taglineB')}</span>
          </p>
          <form
            onSubmit={handleLogin}
            noValidate
            className="mt-8 flex w-full flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
          >
            <TextField
              autoFocus={true}
              label="User ID"
              name="userId"
              value={userInfo.userId}
              onChange={handleChange}
              required={true}
            />
            <TextField
              label="Password"
              name="userPwd"
              value={userInfo.userPwd}
              onChange={handleChange}
              type="password"
              required={true}
            />
            <Button type="submit" size="lg" className="mt-2 w-full">
              Login
            </Button>
          </form>
          {APP_MODE != 'prod' && (
            <div className="mt-6 flex flex-row items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <RouterLink to="/signup" className="text-sm text-inherit underline hover:underline">
                {t('login.signup')}
              </RouterLink>
              <span aria-hidden="true" className="h-2.5 w-px bg-border" />
              <span>{t('login.findAccount')}</span>
            </div>
          )}
        </div>
        <Copyright className="relative z-10 mt-8" />
        <img
          src={backgroundImage}
          alt=""
          className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-auto w-[1024px] max-w-none -translate-x-1/2 opacity-30"
        />
      </main>
    );
  }
};

export default Login;
