import React, { Component, ReactNode, ErrorInfo as ReactErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorUI from './ErrorUI';
import { ErrorBoundaryState, ErrorInfo, ErrorType, ErrorSeverity, ErrorRecoveryOptions } from './types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'global' | 'route' | 'component';
}

// HOC to provide navigation functionality to class component
function withNavigation<P extends object>(Component: React.ComponentType<P>) {
  return function NavigationWrapper(props: P) {
    const navigate = useNavigate();
    return <Component {...props} navigate={navigate} />;
  };
}

interface GlobalErrorBoundaryProps extends Props {
  navigate?: (path: string | number) => void;
}

class GlobalErrorBoundaryClass extends Component<GlobalErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string = '';

  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo) {
    const errorType = this.categorizeError(error);
    const severity = this.getErrorSeverity(errorType, error);
    
    const customErrorInfo: ErrorInfo = {
      type: errorType,
      severity,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metadata: {
        level: this.props.level || 'global',
        componentStack: errorInfo.componentStack,
      },
    };

    this.errorId = `${customErrorInfo.timestamp}-${customErrorInfo.type}`;
    
    this.setState({
      hasError: true,
      error,
      errorInfo: customErrorInfo,
      errorId: this.errorId,
    });

    // 에러 리포팅
    if (this.props.onError) {
      this.props.onError(error, customErrorInfo);
    }

    // 개발 환경에서 콘솔 로깅
    if (process.env.NODE_ENV === 'development') {
      console.error('GlobalErrorBoundary caught an error:', error, errorInfo);
      console.error('Custom error info:', customErrorInfo);
    }

    // 프로덕션 환경에서 에러 리포팅 서비스에 전송
    if (process.env.NODE_ENV === 'production') {
      this.reportToService(error, customErrorInfo);
    }
  }

  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // 청크 로딩 에러
    if (message.includes('loading chunk') || 
        message.includes('failed to fetch') ||
        message.includes('loading css chunk')) {
      return ErrorType.CHUNK_LOAD_ERROR;
    }

    // 네트워크 에러
    if (message.includes('network') || 
        message.includes('fetch') ||
        message.includes('xhr') ||
        message.includes('timeout')) {
      return ErrorType.NETWORK_ERROR;
    }

    // 권한 에러
    if (message.includes('permission') || 
        message.includes('unauthorized') ||
        message.includes('forbidden')) {
      return ErrorType.PERMISSION_ERROR;
    }

    // 차트 렌더링 에러
    if (stack.includes('chart') || 
        stack.includes('echarts') ||
        stack.includes('d3') ||
        message.includes('canvas')) {
      return ErrorType.CHART_RENDER_ERROR;
    }

    // API 에러
    if (message.includes('api') || 
        message.includes('http') ||
        message.includes('response')) {
      return ErrorType.API_ERROR;
    }

    return ErrorType.JAVASCRIPT_ERROR;
  }

  private getErrorSeverity(type: ErrorType, error: Error): ErrorSeverity {
    switch (type) {
      case ErrorType.CHUNK_LOAD_ERROR:
        return ErrorSeverity.HIGH;
      case ErrorType.NETWORK_ERROR:
        return ErrorSeverity.MEDIUM;
      case ErrorType.PERMISSION_ERROR:
        return ErrorSeverity.HIGH;
      case ErrorType.CHART_RENDER_ERROR:
        return ErrorSeverity.MEDIUM;
      case ErrorType.API_ERROR:
        return ErrorSeverity.MEDIUM;
      default:
        // JavaScript 에러의 경우 메시지로 심각도 판단
        if (error.message.includes('critical') || error.message.includes('fatal')) {
          return ErrorSeverity.CRITICAL;
        }
        return ErrorSeverity.MEDIUM;
    }
  }

  private reportToService(error: Error, errorInfo: ErrorInfo) {
    // TODO: Sentry, LogRocket, 또는 다른 에러 리포팅 서비스 연동
    console.log('Error would be reported to external service:', {
      error: error.message,
      errorInfo,
    });
  }

  private getRecoveryOptions(): ErrorRecoveryOptions {
    if (!this.state.errorInfo) {
      return { canRetry: true, canReload: true, canGoBack: false };
    }

    const { type } = this.state.errorInfo;

    switch (type) {
      case ErrorType.CHUNK_LOAD_ERROR:
        return {
          canRetry: false,
          canReload: true,
          canGoBack: false,
        };
      case ErrorType.NETWORK_ERROR:
        return {
          canRetry: true,
          canReload: true,
          canGoBack: true,
        };
      case ErrorType.PERMISSION_ERROR:
        return {
          canRetry: false,
          canReload: false,
          canGoBack: true,
        };
      case ErrorType.CHART_RENDER_ERROR:
        return {
          canRetry: true,
          canReload: false,
          canGoBack: true,
        };
      case ErrorType.API_ERROR:
        return {
          canRetry: true,
          canReload: true,
          canGoBack: true,
        };
      default:
        return {
          canRetry: true,
          canReload: true,
          canGoBack: true,
        };
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (this.props.navigate) {
      this.props.navigate(-1);
    } else {
      window.history.back();
    }
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // 커스텀 fallback이 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const recoveryOptions = this.getRecoveryOptions();

      return (
        <ErrorUI
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onGoBack={this.handleGoBack}
          recoveryOptions={recoveryOptions}
        />
      );
    }

    return this.props.children;
  }
}

// Export the component with navigation HOC
const GlobalErrorBoundary = withNavigation(GlobalErrorBoundaryClass);

export default GlobalErrorBoundary;