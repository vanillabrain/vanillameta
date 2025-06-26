import React from 'react';
import { Box, Typography, Alert, Stack, Collapse, Paper, Chip } from '@mui/material';
import { Button } from '@/components/ui/mui-button-compat';
import {
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import { ErrorUIProps, ErrorType, ErrorSeverity } from './types';

const ErrorUI: React.FC<ErrorUIProps> = ({ errorInfo, onRetry, onReload, onGoBack, recoveryOptions }) => {
  const [showDetails, setShowDetails] = React.useState(false);

  const getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case ErrorType.CHUNK_LOAD_ERROR:
        return '📦';
      case ErrorType.NETWORK_ERROR:
        return '🌐';
      case ErrorType.PERMISSION_ERROR:
        return '🔒';
      case ErrorType.CHART_RENDER_ERROR:
        return '📊';
      case ErrorType.API_ERROR:
        return '🔗';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = (type: ErrorType) => {
    switch (type) {
      case ErrorType.CHUNK_LOAD_ERROR:
        return '페이지 로딩 오류';
      case ErrorType.NETWORK_ERROR:
        return '네트워크 연결 오류';
      case ErrorType.PERMISSION_ERROR:
        return '권한 오류';
      case ErrorType.CHART_RENDER_ERROR:
        return '차트 렌더링 오류';
      case ErrorType.API_ERROR:
        return 'API 통신 오류';
      default:
        return '예상치 못한 오류';
    }
  };

  const getErrorDescription = (type: ErrorType) => {
    switch (type) {
      case ErrorType.CHUNK_LOAD_ERROR:
        return '페이지 모듈을 로드하는 중 문제가 발생했습니다. 페이지를 새로고침해 주세요.';
      case ErrorType.NETWORK_ERROR:
        return '인터넷 연결을 확인하시고 다시 시도해 주세요.';
      case ErrorType.PERMISSION_ERROR:
        return '요청하신 작업을 수행할 권한이 없습니다. 관리자에게 문의해 주세요.';
      case ErrorType.CHART_RENDER_ERROR:
        return '차트를 그리는 중 문제가 발생했습니다. 데이터를 확인하고 다시 시도해 주세요.';
      case ErrorType.API_ERROR:
        return '서버와의 통신 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      default:
        return '예상치 못한 문제가 발생했습니다. 페이지를 새로고침하거나 다시 시도해 주세요.';
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'error';
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="400px"
      p={3}
      sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
        {/* 에러 아이콘 및 타이틀 */}
        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>
          {getErrorIcon(errorInfo.type)}
        </Typography>

        <Typography variant="h5" gutterBottom>
          {getErrorTitle(errorInfo.type)}
        </Typography>

        {/* 심각도 표시 */}
        <Box mb={2}>
          <Chip label={errorInfo.severity.toUpperCase()} color={getSeverityColor(errorInfo.severity) as any} size="small" />
        </Box>

        {/* 에러 설명 */}
        <Alert severity={getSeverityColor(errorInfo.severity) as any} sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body1" gutterBottom>
            {getErrorDescription(errorInfo.type)}
          </Typography>
          {errorInfo.message && (
            <Typography variant="body2" color="text.secondary">
              세부사항: {errorInfo.message}
            </Typography>
          )}
        </Alert>

        {/* 복구 옵션 버튼들 */}
        <Stack direction="row" spacing={2} justifyContent="center" mb={3}>
          {recoveryOptions.canRetry && (
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={onRetry} color="primary">
              다시 시도
            </Button>
          )}

          {recoveryOptions.canReload && (
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onReload}>
              페이지 새로고침
            </Button>
          )}

          {recoveryOptions.canGoBack && (
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onGoBack}>
              이전 페이지
            </Button>
          )}

          {recoveryOptions.customAction && (
            <Button variant="outlined" onClick={recoveryOptions.customAction.action}>
              {recoveryOptions.customAction.label}
            </Button>
          )}
        </Stack>

        {/* 기술적 세부사항 토글 */}
        <Box>
          <Button
            variant="text"
            startIcon={<BugReportIcon />}
            endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowDetails(!showDetails)}
            size="small"
          >
            기술적 세부사항
          </Button>

          <Collapse in={showDetails}>
            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: 'grey.50',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                오류 정보:
              </Typography>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                타임스탬프: {new Date(errorInfo.timestamp).toLocaleString('ko-KR')}
                {'\n'}URL: {errorInfo.url}
                {'\n'}타입: {errorInfo.type}
                {'\n'}메시지: {errorInfo.message}
                {errorInfo.stack && (
                  <>
                    {'\n\n'}스택 트레이스:
                    {'\n'}
                    {errorInfo.stack}
                  </>
                )}
                {errorInfo.componentStack && (
                  <>
                    {'\n\n'}컴포넌트 스택:
                    {'\n'}
                    {errorInfo.componentStack}
                  </>
                )}
              </Typography>
            </Paper>
          </Collapse>
        </Box>
      </Paper>
    </Box>
  );
};

export default ErrorUI;
