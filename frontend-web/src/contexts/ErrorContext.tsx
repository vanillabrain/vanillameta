import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { ErrorInfo, ErrorSeverity, ErrorType } from '@/components/ErrorBoundary/types';
import { setGlobalErrorHandler } from '@/helpers/apiHelper';

interface ErrorState {
  errors: ErrorInfo[];
  globalError?: ErrorInfo;
}

interface ErrorContextValue {
  state: ErrorState;
  reportError: (error: Error, type: ErrorType, severity: ErrorSeverity, metadata?: Record<string, unknown>) => void;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  setGlobalError: (errorInfo: ErrorInfo) => void;
  clearGlobalError: () => void;
}

type ErrorAction =
  | { type: 'REPORT_ERROR'; payload: ErrorInfo }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'SET_GLOBAL_ERROR'; payload: ErrorInfo }
  | { type: 'CLEAR_GLOBAL_ERROR' };

const initialState: ErrorState = {
  errors: [],
  globalError: undefined,
};

function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'REPORT_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.payload],
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => `${error.timestamp}-${error.type}` !== action.payload),
      };
    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: [],
      };
    case 'SET_GLOBAL_ERROR':
      return {
        ...state,
        globalError: action.payload,
      };
    case 'CLEAR_GLOBAL_ERROR':
      return {
        ...state,
        globalError: undefined,
      };
    default:
      return state;
  }
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  const generateErrorId = (error: ErrorInfo): string => {
    return `${error.timestamp}-${error.type}`;
  };

  const reportError = (
    error: Error,
    type: ErrorType,
    severity: ErrorSeverity,
    metadata?: Record<string, unknown>
  ) => {
    const errorInfo: ErrorInfo = {
      type,
      severity,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metadata,
    };

    // 개발 환경에서는 콘솔에 에러 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', errorInfo);
    }

    // 프로덕션 환경에서는 에러 리포팅 서비스에 전송 (예: Sentry)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Sentry나 다른 에러 리포팅 서비스로 전송
      console.log('Error would be sent to reporting service:', errorInfo);
    }

    dispatch({ type: 'REPORT_ERROR', payload: errorInfo });
  };

  const clearError = (errorId: string) => {
    dispatch({ type: 'CLEAR_ERROR', payload: errorId });
  };

  const clearAllErrors = () => {
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
  };

  const setGlobalError = (errorInfo: ErrorInfo) => {
    dispatch({ type: 'SET_GLOBAL_ERROR', payload: errorInfo });
  };

  const clearGlobalError = () => {
    dispatch({ type: 'CLEAR_GLOBAL_ERROR' });
  };

  // API 에러 핸들러를 전역으로 설정
  useEffect(() => {
    setGlobalErrorHandler(reportError);
  }, []);

  const value: ErrorContextValue = {
    state,
    reportError,
    clearError,
    clearAllErrors,
    setGlobalError,
    clearGlobalError,
  };

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}