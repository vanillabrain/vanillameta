import React from 'react';
import { Box, LinearProgress, Typography, Paper } from '@mui/material';
import { Button } from '@/components/ui/button';
import { Stop as StopIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

interface ProgressIndicatorProps {
  current: number;
  total?: number;
  percentage?: number;
  isStreaming: boolean;
  onStop?: () => void;
  message?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
  percentage,
  isStreaming,
  onStop,
  message,
}) => {
  const calculatedPercentage = percentage || (total ? (current / total) * 100 : 0);
  const isIndeterminate = !total && isStreaming;

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        minWidth: 320,
        p: 2,
        zIndex: 1300,
        backgroundColor: 'background.paper',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
          {isStreaming ? (
            <Typography variant="subtitle2" color="primary">
              데이터 로딩 중...
            </Typography>
          ) : (
            <>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="subtitle2" color="success.main">
                로딩 완료
              </Typography>
            </>
          )}
        </Box>
        {isStreaming && onStop && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onStop} 
            className="text-destructive hover:text-destructive/90 min-w-0 p-1"
          >
            <StopIcon fontSize="small" />
          </Button>
        )}
      </Box>

      <LinearProgress
        variant={isIndeterminate ? 'indeterminate' : 'determinate'}
        value={isIndeterminate ? undefined : Math.min(calculatedPercentage, 100)}
        sx={{ mb: 1, height: 8, borderRadius: 1 }}
      />

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {current.toLocaleString()} 행 로드됨
          {total && ` / ${total.toLocaleString()} 행`}
        </Typography>
        {!isIndeterminate && (
          <Typography variant="caption" color="text.secondary">
            {calculatedPercentage.toFixed(1)}%
          </Typography>
        )}
      </Box>

      {message && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {message}
        </Typography>
      )}
    </Paper>
  );
};

export default ProgressIndicator;
