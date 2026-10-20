import React, { useContext, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatasetService from '@/api/datasetService';
import { useStreamingData } from '@/hooks/useStreamingData';
import ProgressIndicator from '@/components/ProgressIndicator';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { usePerformance } from '@/contexts/PerformanceContext';
import { ChartPerformanceWrapper } from '@/components/PerformanceWrapper/ChartPerformanceWrapper';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';

const WidgetWrapper = props => {
  const { t } = useTranslation();
  const { widgetOption, dataSetId, size, enableStreaming = false } = props;
  const { markStart, markEnd } = usePerformance();
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dataset, setDataset] = useState(null);
  const snackbar = useAlert(SnackbarContext);
  const [isInvalidData, setIsInvalidData] = useState(false);
  const [streamingMode, setStreamingMode] = useState(false);
  const request = useRef(0);
  const stream = useStreamingData({ maxDataSize: widgetOption.maxDataSize || 50000 });

  useEffect(() => {
    request.current += 1;
    const generation = request.current;
    setDataset(null);
    setIsInvalidData(false);
    setStreamingMode(false);
    if (dataSetId) {
      if (!enableStreaming) getData(generation);
      else
        DatasetService.executeCachedQuery(String(widgetOption.datasetId), { useStreamingFallback: true })
          .then(response => {
            if (generation !== request.current) return;
            const body = response.data;
            if (body.status !== STATUS.SUCCESS) throw new Error('Dataset query failed');
            if (
              body.data === 'STREAMING_RESPONSE' ||
              (Array.isArray(body.data) && body.data.length > (widgetOption.streamingThreshold || 10000))
            ) {
              setStreamingMode(true);
              void stream.startStreaming(String(widgetOption.datasetId));
            } else setDataset(body.data);
          })
          .catch(() => {
            if (generation === request.current) setIsInvalidData(true);
          });
    }
    return () => {
      request.current += 1;
      stream.stopStreaming();
    };
  }, [dataSetId, enableStreaming]);

  /**
   * 데이터셋 조회
   */
  const getData = (generation: number) => {
    const mark = `widget-data-fetch-${widgetOption.componentType}`;
    markStart(mark, { widgetId: widgetOption.widgetId, datasetId: widgetOption.datasetId });
    showLoading();
    const param = { datasetType: widgetOption.datasetType, datasetId: widgetOption.datasetId };
    DatabaseService.selectData(param)
      .then(response => {
        if (generation !== request.current) return;
        if (response.data.status === STATUS.SUCCESS) {
          setDataset(response.data.data.datas);
        }
      })
      .catch(error => {
        if (generation !== request.current) return;
        setIsInvalidData(true);
        snackbar.error(t('common.dbFetchFailed'));
        console.log('error', error);
      })
      .finally(() => {
        markEnd(mark);
        hideLoading();
      });
  };

  const displayData = streamingMode ? stream.data : dataset;

  return (
    <>
      <ChartPerformanceWrapper
        chartType={String(widgetOption.componentType)}
        widgetId={String(widgetOption.widgetId || dataSetId)}
        dataSize={displayData?.length}
      >
        <WidgetViewer
          title={widgetOption.title}
          description={widgetOption.description}
          widgetType={widgetOption.componentType}
          widgetOption={widgetOption.option}
          dataSet={displayData}
          isInvalidData={isInvalidData || (streamingMode && Boolean(stream.error))}
          isStreaming={streamingMode && stream.isStreaming}
          isLoading={streamingMode && stream.isLoading}
          size={size}
        />
      </ChartPerformanceWrapper>
      {streamingMode && (stream.isStreaming || stream.progress) && (
        <ProgressIndicator
          current={stream.progress?.current || displayData?.length || 0}
          total={stream.progress?.total}
          percentage={stream.progress?.percentage}
          isStreaming={stream.isStreaming}
          onStop={stream.isStreaming ? stream.stopStreaming : undefined}
        />
      )}
    </>
  );
};

export default WidgetWrapper;
