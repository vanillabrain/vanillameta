import React, { useContext, useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';

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
      <main className="relative z-0 h-full w-full min-w-full bg-muted">
        <Seo title={t('signup.title')} />
        <div className="flex flex-col items-center pt-10 sm:pt-[90px]">
          <RouterLink to="/">
            <Logo width="223px" height="43px" aria-label="VanillaMeta" />
          </RouterLink>
          <Card className="mt-8 w-[560px] max-w-[calc(100vw-40px)] gap-0 rounded-none border border-border px-6 pt-8 pb-10 shadow-none ring-0 sm:px-[100px] sm:pt-[60px] sm:pb-[80px]">
            <form onSubmit={handleSignup} noValidate className="flex w-full flex-col gap-5">
              <p className="mb-9 text-2xl leading-[1.33] font-semibold text-foreground">
                <span className="text-primary">{t('signup.taglineA')}</span>
                {t('signup.taglineB')}
              </p>
              <TextField
                required
                label="User ID"
                name="userId"
                type="text"
                value={userInfo.userId}
                onChange={handleChange}
              />
              <TextField
                required
                name="userPwd"
                value={userInfo.userPwd}
                onChange={handleChange}
                label="Password"
                type="password"
              />
              <TextField
                required
                name="userConfirmPwd"
                value={userInfo.userConfirmPwd}
                onChange={handleChange}
                label="Confirm Password"
                type="password"
              />
              <TextField
                required
                name="userEmail"
                value={userInfo.userEmail}
                onChange={handleChange}
                label="E-mail"
                type="email"
              />
              <Button type="submit" size="lg" className="mt-5 mb-4 w-full">
                {t('signup.submit')}
              </Button>
            </form>
            <div className="mt-[50px] flex items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <RouterLink to="/login" className="text-sm text-inherit hover:underline">
                {t('login.title')}
              </RouterLink>
              <span aria-hidden="true" className="h-2.5 w-px bg-border" />
              <span>{t('login.findAccount')}</span>
            </div>
          </Card>
        </div>
        <Copyright className="mt-10" />
      </main>
    );
  }
};

export default SignUp;
