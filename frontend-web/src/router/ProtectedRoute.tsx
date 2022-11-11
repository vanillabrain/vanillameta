import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  console.log('ProtectedRoute', token);
  const storage = window.sessionStorage;
  const loggedUserId = storage.getItem('loggedUserId');
  const loggedUserPwd = storage.getItem('loggedUserPwd');

  if (!loggedUserId && !loggedUserPwd && !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
