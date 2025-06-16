import authService from '@/api/authService';
import { ReactComponent as Logo } from '@/assets/images/logo.svg';
import backgroundImage from '@/assets/images/visual-bg.png';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { getToken, setToken } from '@/helpers/authHelper';
import { Copyright } from '@/layouts/Footer';
import Seo from '@/seo/Seo';
import { checkId, checkPwd } from '@/utils/util';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useAlert } from 'react-alert';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

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
        <Seo title="로그인" />
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
          <Typography sx={{ mt: '17px', fontSize: '16px', color: '#043f84', textAlign: 'center' }}>
            통합 데이터 분석을 위한{' '}
            <Typography component="span" sx={{ fontSize: '16px', fontWeight: 'bold' }}>
              대시보드 리포팅 솔루션
            </Typography>
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
              label="User ID"
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
              label="Password"
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
              Login
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
                회원가입
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
                아이디/비번찾기
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
