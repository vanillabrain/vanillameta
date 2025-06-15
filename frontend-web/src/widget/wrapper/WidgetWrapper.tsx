import React, { useContext, useEffect, useState, useMemo } from 'react';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import DatasetService from '@/api/datasetService';
import { STATUS } from '@/constant';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';
import { usePerformance } from '@/contexts/PerformanceContext';
import { ChartPerformanceWrapper } from '@/components/PerformanceWrapper/ChartPerformanceWrapper';
import { useStreamingData } from '@/hooks/useStreamingData';
import ProgressIndicator from '@/components/ProgressIndicator';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId, size, enableStreaming = false } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const { markStart, markEnd } = usePerformance();
  const [dataset, setDataset] = useState(null);
  const snackbar = useAlert(SnackbarContext);
  const [isInvalidData, setIsInvalidData] = useState(false);
  
  // 스트리밍 데이터 훅
  const {
    data: streamingData,
    isLoading: isStreamingLoading,
    isStreaming,
    error: streamingError,
    progress,
    startStreaming,
    stopStreaming,
  } = useStreamingData({
    maxDataSize: widgetOption.maxDataSize || 50000,
  });

  // 데이터 행 수 임계값 (이 값 이상이면 스트리밍 모드 자동 활성화)
  const DATA_THRESHOLD = widgetOption.streamingThreshold || 10000;
  const [useStreamingMode, setUseStreamingMode] = useState(false);

  useEffect(() => {
    if (dataSetId) {
      checkDataSizeAndLoad();
    }
    
    return () => {
      // 컴포넌트 언마운트 시 스트리밍 중단
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, [dataSetId]);

  /**
   * 데이터 크기 확인 후 로딩 방식 결정
   */
  const checkDataSizeAndLoad = async () => {
    if (!enableStreaming) {
      // 스트리밍이 비활성화된 경우 기존 방식 사용
      getData();
      return;
    }

    try {
      // 캐시된 쿼리로 먼저 시도 (빠른 응답)
      const response = await DatasetService.executeCachedQuery(
        widgetOption.datasetId,
        { useStreamingFallback: true }
      );

      if (response.data.status === STATUS.SUCCESS) {
        const dataLength = response.data.data?.length || 0;
        
        if (dataLength > DATA_THRESHOLD || response.data.data === 'STREAMING_RESPONSE') {
          // 대용량 데이터인 경우 스트리밍 모드 사용
          setUseStreamingMode(true);
          startStreaming(widgetOption.datasetId);
        } else {
          // 소규모 데이터는 일반 모드 사용
          setDataset(response.data.data);
        }
      }
    } catch (error) {
      // 캐시 조회 실패 시 기존 방식으로 폴백
      getData();
    }
  };

  /**
   * 기존 데이터셋 조회
   */
  const getData = () => {
    showLoading();
    
    // 데이터 조회 성능 측정 시작
    const perfMark = `widget-data-fetch-${widgetOption.componentType}`;
    markStart(perfMark, {
      widgetId: widgetOption.widgetId,
      datasetId: widgetOption.datasetId,
      componentType: widgetOption.componentType,
    });
    
    const param = { datasetType: widgetOption.datasetType, datasetId: widgetOption.datasetId };
    DatabaseService.selectData(param)
      .then(response => {
        console.log('selectData', response.data);
        if (response.data.status === STATUS.SUCCESS) {
          setDataset(response.data.data.datas);
        }
      })
      .catch(error => {
        setIsInvalidData(true);
        snackbar.error('데이터베이스 조회에 실패했습니다.');
        console.log('error', error);
      })
      .finally(() => {
        hideLoading();
        // 데이터 조회 성능 측정 종료
        markEnd(perfMark);
      });
  };

  // 표시할 데이터 (일반 모드 또는 스트리밍 모드)
  const displayData = useMemo(() => {
    if (useStreamingMode) {
      return streamingData;
    }
    return dataset;
  }, [useStreamingMode, streamingData, dataset]);

  // 에러 처리
  useEffect(() => {
    if (streamingError) {
      setIsInvalidData(true);
      snackbar.error(`스트리밍 오류: ${streamingError}`);
    }
  }, [streamingError, snackbar]);

  return (
    <>
      <ChartPerformanceWrapper
        chartType={widgetOption.componentType}
        widgetId={widgetOption.widgetId}
        dataSize={displayData?.length || 0}
      >
        <WidgetViewer
          title={widgetOption.title}
          widgetType={widgetOption.componentType}
          widgetOption={widgetOption.option}
          dataSet={displayData}
          isInvalidData={isInvalidData}
          isLoading={isStreamingLoading && !isStreaming}
          isStreaming={isStreaming}
          size={size}
        />
      </ChartPerformanceWrapper>
      
      {/* 스트리밍 진행률 표시 */}
      {useStreamingMode && (isStreaming || progress) && (
        <ProgressIndicator
          current={progress?.current || displayData?.length || 0}
          total={progress?.total}
          percentage={progress?.percentage}
          isStreaming={isStreaming}
          onStop={isStreaming ? stopStreaming : undefined}
        />
      )}
    </>
  );
};

export default WidgetWrapper;
