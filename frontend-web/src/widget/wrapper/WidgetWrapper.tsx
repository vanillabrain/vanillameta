import React, { useEffect, useState } from 'react';
import { get } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';

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
    get('http://localhost:3000/data/sample/chartFull.json').then(response => {
      console.log('res', response.data);
      setDataset(response.data.data);
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
