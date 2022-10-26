import React, { useContext, useEffect, useState } from 'react';
import { get } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { LoadingContext } from '@/contexts/LoadingContext';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [dataset, setDataset] = useState(null);

  useEffect(() => {
    // console.log('WidgetWrapper widgetOption', widgetOption);
    // console.log('WidgetWrapper dataSetId', dataSetId);

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
      .finally(() => {
        hideLoading();
      });
  };

  return (
    <WidgetViewer
      title={widgetOption.title}
      widgetType={widgetOption.componentType}
      widgetOption={widgetOption.option}
      dataSet={dataset}
    />
  );
};

export default WidgetWrapper;
