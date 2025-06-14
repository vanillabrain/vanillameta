import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ChartErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Check if it's a chunk loading error
      const isChunkError = this.state.error?.message?.includes('Loading chunk') || 
                          this.state.error?.message?.includes('Failed to fetch');

      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          height="100%" 
          p={3}
        >
          <Alert 
            severity="error" 
            sx={{ mb: 2, width: '100%', maxWidth: 500 }}
          >
            <Typography variant="h6" gutterBottom>
              차트 로딩 오류
            </Typography>
            <Typography variant="body2">
              {isChunkError 
                ? '차트 모듈을 로드하는 중 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.'
                : '차트를 렌더링하는 중 오류가 발생했습니다.'}
            </Typography>
          </Alert>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={isChunkError ? () => window.location.reload() : this.handleReset}
          >
            {isChunkError ? '페이지 새로고침' : '다시 시도'}
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}