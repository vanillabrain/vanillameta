import React, { useEffect, useState } from 'react';
import { get } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId } = props;

  const [dataset, setDataset] = useState(null);
  useEffect(() => {
    console.log('WidgetWrapper widgetOption', widgetOption);
    console.log('WidgetWrapper dataSetId', dataSetId);

    if (dataSetId) {
      getData();
    }
  }, [dataSetId]);

  /**
   * 데이터셋 조회
   */
  const getData = () => {
    const param = { datasetType: widgetOption.datasetType, datasetId: widgetOption.datasetId };
    DatabaseService.selectData(param).then(response => {
      console.log('selectData', response.data);
      if (response.data.status === STATUS.SUCCESS) {
        setDataset(response.data.data.datas);
      }
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
