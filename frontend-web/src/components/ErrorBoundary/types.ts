export enum ErrorType {
  CHUNK_LOAD_ERROR = 'chunk_load_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  CHART_RENDER_ERROR = 'chart_render_error',
  JAVASCRIPT_ERROR = 'javascript_error',
  API_ERROR = 'api_error',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export interface ErrorRecoveryOptions {
  canRetry: boolean;
  canReload: boolean;
  canGoBack: boolean;
  customAction?: {
    label: string;
    action: () => void;
  };
}

export interface ErrorUIProps {
  error: Error;
  errorInfo: ErrorInfo;
  onRetry: () => void;
  onReload: () => void;
  onGoBack: () => void;
  recoveryOptions: ErrorRecoveryOptions;
}
