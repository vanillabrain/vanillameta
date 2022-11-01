import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Button, Checkbox, Container, FormControlLabel, Link, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';

function Copyright(props: any) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      <Link color="inherit" href="https://vanillabrain.com/" sx={{ textDecoration: 'none' }}>
        @Vanilla Meta
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const Login = () => {
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [userInfo] = useState({
    userId: process.env.REACT_APP_MODE === 'local' ? process.env.REACT_APP_ID : '',
    userPwd: process.env.REACT_APP_MODE === 'local' ? process.env.REACT_APP_PWD : '',
  });

  const handleLogin = async event => {
    event.preventDefault();
    showLoading();
    await onLogin(event.target.userId.value, event.target.userPwd.value)
      .then(res => {
        if (res) {
          navigate('/dashboard');
        }
      })
      .catch(error => {
        alert.info(`${error}`);
        console.log('error', error);
      })
      .finally(() => {
        hideLoading();
      });
  };
  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Stack component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }} spacing="20px">
          <TextField margin="normal" required fullWidth id="userId" label="ID" name="email" defaultValue={userInfo.userId} />
          <TextField
            margin="normal"
            required
            fullWidth
            name="userPwd"
            defaultValue={userInfo.userPwd}
            label="Password"
            type="password"
            id="password"
          />
          <FormControlLabel control={<Checkbox value="remember" color="primary" />} label="Remember me" />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
            Sign In
          </Button>
        </Stack>
      </Box>
      <Copyright sx={{ mt: 8, mb: 4 }} />
    </Container>
  );
};

export default Login;
