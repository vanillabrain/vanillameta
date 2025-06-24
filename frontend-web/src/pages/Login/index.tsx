import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
import { trackUserSession } from '@/utils/eventTracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Login = () => {
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
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
        .then((response: any) => {
          console.log('로그인 응답:', response);
          // API 헬퍼의 post 함수는 response.data를 반환하므로 accessToken과 message를 직접 확인
          if (response?.accessToken && response?.message === 'success') {
            const token: string = response.accessToken;
            console.log('받은 토큰:', token);
            setToken(token);
            console.log('토큰 설정 완료, 사용자 정보 가져오는 중...');
            // 토큰 설정 후 사용자 정보를 먼저 가져온 다음 대시보드로 이동
            return authService.getUserInfo();
          } else {
            console.log('로그인 실패: 응답', response);
            throw new Error('로그인 실패');
          }
        })
        .then((userResponse: any) => {
          console.log('사용자 정보 응답:', userResponse);
          console.log('userResponse 타입:', typeof userResponse);
          console.log('userResponse null 체크:', userResponse === null);
          console.log('userResponse undefined 체크:', userResponse === undefined);

          // API 헬퍼의 get 함수는 response.data를 반환하므로 데이터 자체가 있으면 성공으로 간주
          if (userResponse) {
            console.log('대시보드로 이동 중...');
            navigate('/dashboard');
          } else {
            console.log('사용자 정보가 null/undefined입니다.');
          }
        })
        .catch(error => {
          console.log(error);
          if (error.response && error.response.status === 401) {
            snackbar.error('ID 또는 비밀번호가 일치하지 않습니다.');
            return;
          }
          alert.error('로그인에 실패했습니다. 다시 시도해주세요.');
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
      isValid = true;
    }
  };

  if (!token) {
    return (
      <main className="relative z-0 w-full h-full min-w-screen bg-[#f5f6f8]">
        <Seo title="로그인" />
        <div className="pt-[90px] flex flex-col items-center">
          <RouterLink to="/">
            <Logo width="223px" height="43px" />
          </RouterLink>
          <p className="mt-4 text-base text-[#043f84] text-center">
            통합 데이터 분석을 위한{' '}
            <span className="text-base font-bold">대시보드 리포팅 솔루션</span>
          </p>
          <form
            onSubmit={handleLogin}
            noValidate
            className="w-[calc(100%-40px)] sm:w-[360px] mt-14 space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                autoFocus={true}
                id="userId"
                name="userId"
                value={userInfo.userId}
                onChange={handleChange}
                required={true}
                className="h-11 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPwd">Password</Label>
              <Input
                id="userPwd"
                name="userPwd"
                value={userInfo.userPwd}
                onChange={handleChange}
                type="password"
                required={true}
                className="h-11 sm:h-9"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full h-[50px] sm:h-11 mt-3 mb-2"
            >
              Login
            </Button>
          </form>
          {APP_MODE != 'prod' && (
            <div className="flex flex-row justify-center items-center gap-3 mt-10 text-sm text-center text-[#4a4a4a]">
              <RouterLink
                to="/signup"
                className="flex justify-center items-center min-w-0 min-h-0 m-0 p-0 gap-3 text-inherit font-inherit underline hover:underline hover:bg-inherit after:content-[''] after:w-[1px] after:h-[10px] after:bg-[#cccfd8]"
              >
                회원가입
              </RouterLink>
              <button
                className="min-w-0 min-h-0 m-0 p-0 text-inherit font-inherit text-[#4a4a4a] hover:bg-inherit"
              >
                아이디/비번찾기
              </button>
            </div>
          )}
        </div>
        <Copyright className="mt-[50px] mb-4" />
        <img
          src={backgroundImage}
          className="fixed z-[-1] bottom-0 left-1/2 m-auto w-[1024px] h-[508px] -translate-x-1/2"
          alt="Background"
        />
      </main>
    );
  }
};

export default Login;
