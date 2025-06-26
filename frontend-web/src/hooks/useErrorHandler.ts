import { useCallback } from 'react';
import { useError } from '@/contexts/ErrorContext';
import { ErrorType, ErrorSeverity } from '@/components/ErrorBoundary/types';
import { useAlert } from 'react-alert';

interface ApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data?: any;
  };
  request?: any;
  code?: string;
}

interface UseErrorHandlerReturn {
  handleError: (error: Error | ApiError, context?: string) => void;
  handleApiError: (error: ApiError, context?: string) => void;
  handleNetworkError: (error: Error, context?: string) => void;
  handleChunkError: (error: Error, context?: string) => void;
  handlePermissionError: (error: Error, context?: string) => void;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const { reportError } = useError();
  const alert = useAlert();

  const getErrorSeverityFromStatus = (status: number): ErrorSeverity => {
    if (status >= 500) return ErrorSeverity.HIGH;
    if (status >= 400 && status < 500) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  };

  const getUserFriendlyMessage = (error: ApiError): string => {
    if (!error.response) {
      return '네트워크 연결을 확인해 주세요.';
    }

    const { status } = error.response;

    switch (status) {
      case 400:
        return '잘못된 요청입니다. 입력 내용을 확인해 주세요.';
      case 401:
        return '로그인이 필요합니다.';
      case 403:
        return '접근 권한이 없습니다.';
      case 404:
        return '요청하신 리소스를 찾을 수 없습니다.';
      case 408:
        return '요청 시간이 초과되었습니다. 다시 시도해 주세요.';
      case 429:
        return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.';
      case 500:
        return '서버 내부 오류가 발생했습니다.';
      case 502:
        return '서버 연결에 문제가 있습니다.';
      case 503:
        return '서비스를 일시적으로 사용할 수 없습니다.';
      case 504:
        return '서버 응답 시간이 초과되었습니다.';
      default:
        return '예상치 못한 오류가 발생했습니다.';
    }
  };

  const handleError = useCallback(
    (error: Error | ApiError, context?: string) => {
      console.error('Error handled:', error, 'Context:', context);

      // API 에러인지 확인
      if ('response' in error || 'request' in error) {
        handleApiError(error as ApiError, context);
        return;
      }

      // 청크 로딩 에러인지 확인
      if (error.message.includes('Loading chunk') || error.message.includes('Failed to fetch')) {
        handleChunkError(error, context);
        return;
      }

      // 일반 JavaScript 에러
      reportError(error, ErrorType.JAVASCRIPT_ERROR, ErrorSeverity.MEDIUM, {
        context,
        timestamp: Date.now(),
      });

      // 사용자에게 알림 표시
      alert.error('오류가 발생했습니다. 다시 시도해 주세요.');
    },
    [reportError, alert],
  );

  const handleApiError = useCallback(
    (error: ApiError, context?: string) => {
      const severity = error.response ? getErrorSeverityFromStatus(error.response.status) : ErrorSeverity.HIGH;
      const userMessage = getUserFriendlyMessage(error);

      reportError(error, ErrorType.API_ERROR, severity, {
        context,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.request?.responseURL,
        method: error.request?.method,
        timestamp: Date.now(),
      });

      // 401 에러의 경우 로그인 페이지로 리다이렉트
      if (error.response?.status === 401) {
        // 로그인 페이지로 리다이렉트 로직
        window.location.href = '/login';
        return;
      }

      // 사용자에게 친화적인 에러 메시지 표시
      alert.error(userMessage);
    },
    [reportError, alert],
  );

  const handleNetworkError = useCallback(
    (error: Error, context?: string) => {
      reportError(error, ErrorType.NETWORK_ERROR, ErrorSeverity.HIGH, {
        context,
        timestamp: Date.now(),
      });

      alert.error('네트워크 연결을 확인하고 다시 시도해 주세요.');
    },
    [reportError, alert],
  );

  const handleChunkError = useCallback(
    (error: Error, context?: string) => {
      reportError(error, ErrorType.CHUNK_LOAD_ERROR, ErrorSeverity.HIGH, {
        context,
        timestamp: Date.now(),
      });

      alert.error('페이지를 새로고침해 주세요.');
    },
    [reportError, alert],
  );

  const handlePermissionError = useCallback(
    (error: Error, context?: string) => {
      reportError(error, ErrorType.PERMISSION_ERROR, ErrorSeverity.HIGH, {
        context,
        timestamp: Date.now(),
      });

      alert.error('접근 권한이 없습니다. 관리자에게 문의해 주세요.');
    },
    [reportError, alert],
  );

  return {
    handleError,
    handleApiError,
    handleNetworkError,
    handleChunkError,
    handlePermissionError,
  };
};
