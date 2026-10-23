import React, { useContext, useEffect, useState } from 'react';
import Logo from '@/assets/images/logo.svg?react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
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
import { parseSignupMode, signupErrorKey, SignupMode } from './signupErrors';

const SignUp = () => {
  const { t } = useTranslation();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const [searchParams] = useSearchParams();
  // null until the API has answered; a failed request keeps the invitation field so signup stays usable.
  const [mode, setMode] = useState<SignupMode | null>(null);
  const [userInfo, setUserInfo] = useState({
    userId: '',
    userPwd: '',
    userConfirmPwd: '',
    userEmail: '',
    inviteCode: searchParams.get('invite') ?? '',
  });
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistDone, setWaitlistDone] = useState(false);
  const token = getToken();
  let isValid;

  useEffect(() => {
    if (token) {
      // token이 있으면 대시보드로 보내기
      navigate('/dashboard');
    }
  }, []);

  useEffect(() => {
    let current = true;
    authService
      .getSignupMode()
      .then(response => current && setMode(parseSignupMode(response)))
      .catch(() => current && setMode('invite'));
    return () => {
      current = false;
    };
  }, []);

  const handleWaitlist = event => {
    event.preventDefault();
    if (!checkEmail.test(waitlistEmail)) {
      snackbar.error(t('signup.emailFormat'));
      return;
    }
    authService
      .joinWaitlist(waitlistEmail.trim())
      .then(() => setWaitlistDone(true))
      .catch(error => {
        snackbar.error(t(error?.response?.status === 429 ? 'signup.tooMany' : 'signup.failed'));
      });
  };

  const handleSignup = event => {
    event.preventDefault();
    showLoading();
    validateData();
    if (isValid) {
      const data = {
        userId: userInfo.userId,
        password: userInfo.userPwd,
        email: userInfo.userEmail,
        ...(mode === 'invite' ? { inviteCode: userInfo.inviteCode.trim() } : {}),
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
          const key = signupErrorKey(error);
          if (key === 'signup.dupId' || key === 'signup.dupEmail') snackbar.error(t(key));
          else alert.error(t(key ?? 'signup.failed'));
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
      if (mode === 'invite' && !userInfo.inviteCode.trim()) {
        snackbar.error(t('signup.inviteRequired'));
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
      <main className="relative min-h-full w-full bg-muted px-4 pb-8">
        <Seo title={t('signup.title')} />
        <div className="mx-auto flex max-w-md flex-col items-center pt-10 sm:pt-14">
          <RouterLink to="/">
            <Logo width="223px" height="43px" aria-label="VanillaMeta" />
          </RouterLink>
          <Card className="mt-8 w-full gap-0 rounded-xl border border-border p-6 shadow-sm ring-0 sm:p-8">
            {mode === 'closed' ? (
              <p className="text-base leading-7 text-foreground">{t('signup.closed')}</p>
            ) : (
              <form onSubmit={handleSignup} noValidate className="flex w-full flex-col gap-5">
                <p className="mb-2 text-xl leading-8 sm:text-2xl font-semibold text-foreground">
                  <span className="text-primary">{t('signup.taglineA')}</span>
                  {t('signup.taglineB')}
                </p>
                {mode === 'invite' && (
                  <TextField
                    required
                    label={t('signup.inviteCode')}
                    name="inviteCode"
                    type="text"
                    autoComplete="off"
                    value={userInfo.inviteCode}
                    onChange={handleChange}
                  />
                )}
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
                <Button type="submit" size="lg" className="mt-2 w-full" disabled={mode === null}>
                  {t('signup.submit')}
                </Button>
              </form>
            )}
            {(mode === 'invite' || mode === 'closed') && (
              <form
                onSubmit={handleWaitlist}
                noValidate
                className="mt-6 flex w-full flex-col gap-3 border-t border-border pt-6"
              >
                <p className="text-sm font-medium text-foreground">{t('signup.waitlistTitle')}</p>
                {waitlistDone ? (
                  <p className="text-sm text-muted-foreground">{t('signup.waitlistDone')}</p>
                ) : (
                  <>
                    <TextField
                      label={t('signup.waitlistEmail')}
                      name="waitlistEmail"
                      type="email"
                      value={waitlistEmail}
                      onChange={event => setWaitlistEmail(event.target.value)}
                    />
                    <Button type="submit" variant="outline" className="w-full">
                      {t('signup.waitlistSubmit')}
                    </Button>
                  </>
                )}
              </form>
            )}
            <div className="mt-6 flex items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <RouterLink to="/login" className="text-sm text-inherit hover:underline">
                {t('login.title')}
              </RouterLink>
              <span aria-hidden="true" className="h-2.5 w-px bg-border" />
              <span>{t('login.findAccount')}</span>
            </div>
          </Card>
        </div>
        <Copyright className="mt-8" />
      </main>
    );
  }
};

export default SignUp;
