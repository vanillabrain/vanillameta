import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useAlert } from 'react-alert';
import { SnackbarContext } from '@/contexts/AlertContext';

const WidgetWrapper = props => {
  const { t } = useTranslation();
  const { widgetOption, dataSetId, size } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
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
        snackbar.error(t('common.dbFetchFailed'));
        console.log('error', error);
      })
      .finally(() => {
        hideLoading();
      });
  };

  return (
    <WidgetViewer
      title={widgetOption.title}
      description={widgetOption.description}
      widgetType={widgetOption.componentType}
      widgetOption={widgetOption.option}
      dataSet={dataset}
      isInvalidData={isInvalidData}
      size={size}
    />
  );
};

export default WidgetWrapper;
