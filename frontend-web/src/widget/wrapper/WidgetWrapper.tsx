import { useContext, useEffect } from 'react';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';
import { useQuery } from '@tanstack/react-query';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId, size } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const snackbar = useAlert(SnackbarContext);

  const param = dataSetId
    ? { datasetType: widgetOption.datasetType, datasetId: widgetOption.datasetId }
    : null;

  // 데이터셋 조회
  const { data: dataResponse, isError, isFetching } = useQuery({
    queryKey: ['widget-dataset', param],
    queryFn: async () => (await DatabaseService.selectData(param)).data,
    enabled: !!dataSetId,
  });

  useEffect(() => {
    if (isFetching) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [isFetching]);

  useEffect(() => {
    if (isError) {
      snackbar.error('데이터베이스 조회에 실패했습니다.');
    }
  }, [isError]);

  const dataset = dataResponse?.status === STATUS.SUCCESS ? dataResponse.data.datas : null;

  return (
    <WidgetViewer
      title={widgetOption.title}
      widgetType={widgetOption.componentType}
      widgetOption={widgetOption.option}
      dataSet={dataset}
      isInvalidData={isError}
      size={size}
    />
  );
};

export default WidgetWrapper;
