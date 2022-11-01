import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  console.log('ProtectedRoute', token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
