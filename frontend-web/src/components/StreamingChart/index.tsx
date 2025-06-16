import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { useStreamingData } from '@/hooks/useStreamingData';
import ProgressIndicator from '@/components/ProgressIndicator';

interface StreamingChartProps {
  datasetId: string;
  chartType: 'line' | 'bar' | 'scatter' | 'pie';
  xField?: string;
  yField?: string;
  categoryField?: string;
  valueField?: string;
  height?: number;
  maxDataPoints?: number;
  updateInterval?: number; // 차트 업데이트 간격 (ms)
  autoStart?: boolean;
}

const StreamingChart: React.FC<StreamingChartProps> = ({
  datasetId,
  chartType,
  xField,
  yField,
  categoryField,
  valueField,
  height = 400,
  maxDataPoints = 10000,
  updateInterval = 500,
  autoStart = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataBufferRef = useRef<any[]>([]);
  
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    data,
    isLoading,
    isStreaming,
    error,
    progress,
    startStreaming,
    stopStreaming,
  } = useStreamingData({
    maxDataSize: maxDataPoints,
    onDataChunk: (chunk) => {
      // 새 데이터를 버퍼에 추가
      if (chunk.rows) {
        dataBufferRef.current.push(...chunk.rows);
      }
    },
  });

  // 차트 초기화
  useEffect(() => {
    if (chartRef.current && !chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
      setIsInitialized(true);
      
      // 리사이즈 핸들러
      const handleResize = () => {
        chartInstanceRef.current?.resize();
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstanceRef.current?.dispose();
        chartInstanceRef.current = null;
      };
    }
  }, []);

  // 차트 옵션 생성
  const createChartOption = useCallback((chartData: any[]) => {
    if (chartData.length === 0) {
      return {
        title: {
          text: '데이터를 기다리는 중...',
          left: 'center',
          top: 'center',
        },
      };
    }

    let option: any = {
      tooltip: {
        trigger: chartType === 'pie' ? 'item' : 'axis',
      },
      animation: false, // 스트리밍 시 애니메이션 비활성화
    };

    // 차트 타입별 옵션 설정
    switch (chartType) {
      case 'line':
      case 'bar':
        if (xField && yField) {
          // 데이터 샘플링 (너무 많은 포인트는 성능 저하)
          const sampledData = chartData.length > 5000 
            ? chartData.filter((_, index) => index % Math.ceil(chartData.length / 5000) === 0)
            : chartData;
          
          option = {
            ...option,
            xAxis: {
              type: 'category',
              data: sampledData.map(item => item[xField]),
            },
            yAxis: {
              type: 'value',
            },
            series: [{
              type: chartType,
              data: sampledData.map(item => item[yField]),
              smooth: chartType === 'line',
              sampling: 'lttb', // 다운샘플링 알고리즘
            }],
          };
        }
        break;
        
      case 'scatter':
        if (xField && yField) {
          const sampledData = chartData.length > 5000 
            ? chartData.filter((_, index) => index % Math.ceil(chartData.length / 5000) === 0)
            : chartData;
            
          option = {
            ...option,
            xAxis: { type: 'value' },
            yAxis: { type: 'value' },
            series: [{
              type: 'scatter',
              data: sampledData.map(item => [item[xField], item[yField]]),
              large: true, // 대용량 모드
              largeThreshold: 1000,
            }],
          };
        }
        break;
        
      case 'pie':
        if (categoryField && valueField) {
          // 파이 차트는 집계가 필요
          const aggregated = chartData.reduce((acc, item) => {
            const key = item[categoryField];
            if (!acc[key]) {
              acc[key] = 0;
            }
            acc[key] += Number(item[valueField]) || 0;
            return acc;
          }, {} as Record<string, number>);
          
          option = {
            ...option,
            series: [{
              type: 'pie',
              radius: '60%',
              data: Object.entries(aggregated)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => (b.value as number) - (a.value as number))
                .slice(0, 20), // 상위 20개만 표시
            }],
          };
        }
        break;
    }

    return option;
  }, [chartType, xField, yField, categoryField, valueField]);

  // 차트 업데이트
  const updateChart = useCallback(() => {
    if (!chartInstanceRef.current || !isInitialized) return;

    // 버퍼와 기존 데이터 병합
    const allData = [...data, ...dataBufferRef.current];
    dataBufferRef.current = []; // 버퍼 비우기
    
    const option = createChartOption(allData);
    chartInstanceRef.current.setOption(option, true); // notMerge: true
  }, [data, createChartOption, isInitialized]);

  // 주기적 차트 업데이트
  useEffect(() => {
    if (isStreaming) {
      updateTimerRef.current = setInterval(() => {
        updateChart();
      }, updateInterval);
    } else {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      // 스트리밍 종료 시 최종 업데이트
      updateChart();
    }

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [isStreaming, updateInterval, updateChart]);

  // 자동 시작
  useEffect(() => {
    if (autoStart && datasetId) {
      startStreaming(datasetId);
    }
    
    return () => {
      stopStreaming();
    };
  }, [datasetId, autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // 초기 렌더링 시 차트 업데이트
  useEffect(() => {
    if (isInitialized && !isStreaming && data.length > 0) {
      updateChart();
    }
  }, [data.length, isInitialized, isStreaming, updateChart]);

  return (
    <Paper elevation={1} sx={{ position: 'relative', p: 2 }}>
      {/* 에러 표시 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* 차트 컨테이너 */}
      <Box
        ref={chartRef}
        sx={{
          width: '100%',
          height,
          position: 'relative',
        }}
      />
      
      {/* 로딩 표시 */}
      {isLoading && !isStreaming && data.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            데이터를 로드하는 중...
          </Typography>
        </Box>
      )}
      
      {/* 진행률 표시 */}
      {(isStreaming || (progress && !isStreaming)) && (
        <ProgressIndicator
          current={progress?.current || data.length}
          total={progress?.total}
          percentage={progress?.percentage}
          isStreaming={isStreaming}
          onStop={isStreaming ? stopStreaming : undefined}
        />
      )}
    </Paper>
  );
};

export default StreamingChart;