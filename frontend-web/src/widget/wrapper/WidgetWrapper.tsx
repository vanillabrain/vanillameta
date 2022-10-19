import React, { useEffect, useState } from 'react';
import { get } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId } = props;

  const [dataset, setDataset] = useState(null);
  useEffect(() => {
    console.log('WidgetWrapper', dataSetId);

    if (dataSetId) {
      getData();
    }
  }, [dataSetId]);

  const getData = () => {
    // dataSetId 로 데이터 조회
    // axios.get('/data/sample/chartFull.json').then(response => {
    //   setData(response.data.data);
    //   setSpec(response.data.spec);
    // });
    DatabaseService.selectData(widgetOption).then(response => {
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
