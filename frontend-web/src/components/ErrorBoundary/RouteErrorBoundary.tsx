import React from 'react';
import GlobalErrorBoundary from './GlobalErrorBoundary';
import { useError } from '@/contexts/ErrorContext';
import { ErrorType, ErrorSeverity } from './types';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName: string;
  fallback?: React.ReactNode;
}

const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children, routeName, fallback }) => {
  const { reportError } = useError();

  const handleError = (error: Error, errorInfo: any) => {
    // 라우트별 에러 리포팅
    reportError(error, ErrorType.JAVASCRIPT_ERROR, ErrorSeverity.HIGH, {
      routeName,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
    });
  };

  return (
    <GlobalErrorBoundary level="route" onError={handleError} fallback={fallback}>
      {children}
    </GlobalErrorBoundary>
  );
};

export default RouteErrorBoundary;
