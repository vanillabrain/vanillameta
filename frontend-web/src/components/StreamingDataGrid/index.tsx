import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Alert, CircularProgress } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Stop as StopIcon } from '@mui/icons-material';
import VirtualDataGrid from '@/components/VirtualDataGrid';
import ProgressIndicator from '@/components/ProgressIndicator';
import { useStreamingData } from '@/hooks/useStreamingData';

interface StreamingDataGridProps {
  datasetId?: string;
  height?: number;
  maxRows?: number;
  autoStart?: boolean;
}

const StreamingDataGrid: React.FC<StreamingDataGridProps> = ({
  datasetId,
  height = 600,
  maxRows = 100000,
  autoStart = false,
}) => {
  const { data, isLoading, isStreaming, error, progress, startStreaming, stopStreaming, clearData } = useStreamingData({
    maxDataSize: maxRows,
  });

  const [columns, setColumns] = useState<Array<{ field: string; headerName: string; width?: number }>>([]);

  // 데이터로부터 컬럼 추출
  useEffect(() => {
    if (data.length > 0 && columns.length === 0) {
      const firstRow = data[0];
      const extractedColumns = Object.keys(firstRow).map(key => ({
        field: key,
        headerName: key,
        width: 150, // 기본 너비
      }));
      setColumns(extractedColumns);
    }
  }, [data, columns.length]);

  // 자동 시작
  useEffect(() => {
    if (autoStart && datasetId) {
      startStreaming(datasetId);
    }

    return () => {
      stopStreaming();
    };
    // eslint-disable-next-line
  }, [datasetId, autoStart]);

  // 시작/중지 핸들러
  const handleToggleStreaming = () => {
    if (isStreaming) {
      stopStreaming();
    } else if (datasetId) {
      clearData();
      startStreaming(datasetId);
    }
  };

  // 진행률 메시지 생성
  const progressMessage = useMemo(() => {
    if (!progress) return undefined;

    if (progress.percentage) {
      return `처리 중: ${progress.percentage.toFixed(1)}%`;
    }

    if (progress.total) {
      return `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()} 행`;
    }

    return `${progress.current.toLocaleString()} 행 처리됨`;
  }, [progress]);

  return (
    <Box position="relative">
      {/* 컨트롤 버튼 */}
      <Box mb={2} display="flex" gap={2} alignItems="center">
        <Button
          variant="contained"
          color={isStreaming ? 'error' : 'primary'}
          startIcon={isStreaming ? <StopIcon /> : <PlayArrowIcon />}
          onClick={handleToggleStreaming}
          disabled={!datasetId || isLoading}
        >
          {isStreaming ? '중지' : '시작'}
        </Button>

        {isLoading && !isStreaming && <CircularProgress size={24} />}
      </Box>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 가상 스크롤 데이터 그리드 */}
      <VirtualDataGrid data={data} columns={columns} height={height} isLoading={isStreaming} />

      {/* 진행률 표시 */}
      {(isStreaming || (progress && !isStreaming)) && (
        <ProgressIndicator
          current={progress?.current || data.length}
          total={progress?.total}
          percentage={progress?.percentage}
          isStreaming={isStreaming}
          onStop={isStreaming ? stopStreaming : undefined}
          message={progressMessage}
        />
      )}
    </Box>
  );
};

export default StreamingDataGrid;
