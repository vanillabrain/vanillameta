import React, { useContext, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { getToken } from '@/helpers/authHelper';
import authService from '@/api/authService';

export const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const { userState, setUserState, onRefresh } = useContext(AuthContext);

  // accessToken을 localStorage에서 꺼내기
  const token = getToken();
  console.log('token:', token);
  let sent;

  useEffect(() => {
    getUserState();
  }, [token]);

  const getUserState = () => {
    if (token) {
      // accessToken이 localStorage에 있으면 유저정보 받아오기
      authService
        .getUser()
        .then(response => {
          console.log(response);
          if (response.status === 200) {
            setUserState({ isLogin: true, userId: response.data.data.user_id, userEmail: response.data.data.email });
            console.log(userState, '유저정보');
          }
        })
        .catch(error => {
          navigate('/login');
          throw error;
        });
    } else {
      // accessToken이 localStorage에 없으면 RefreshToken으로 accessToken 재발급받기
      if (!sent) {
        sent = true;
        onRefresh();
        // 다시 처음으로
        getUserState();
      }
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
