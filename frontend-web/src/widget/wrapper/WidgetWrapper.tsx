import React, { useContext, useEffect, useState } from 'react';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';
import { usePerformance } from '@/contexts/PerformanceContext';
import { ChartPerformanceWrapper } from '@/components/PerformanceWrapper/ChartPerformanceWrapper';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId, size } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const { markStart, markEnd } = usePerformance();
  const [dataset, setDataset] = useState(null);
  const snackbar = useAlert(SnackbarContext);
  const [isInvalidData, setIsInvalidData] = useState(false);

  useEffect(() => {
    if (dataSetId) {
      getData();
    }
  }, [dataSetId]);

  /**
   * 데이터셋 조회
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

  return (
    <ChartPerformanceWrapper
      chartType={widgetOption.componentType}
      widgetId={widgetOption.widgetId}
      dataSize={dataset?.length || 0}
    >
      <WidgetViewer
        title={widgetOption.title}
        widgetType={widgetOption.componentType}
        widgetOption={widgetOption.option}
        dataSet={dataset}
        isInvalidData={isInvalidData}
        size={size}
      />
    </ChartPerformanceWrapper>
  );
};

export default WidgetWrapper;
