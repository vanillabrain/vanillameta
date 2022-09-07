import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { useParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import axios from 'axios';

function WidgetModify(props) {
  const { widget_id } = useParams();
  const [data, setData] = useState({
    dataId: 0,
    type: '',
    options: {},
  });
  const [widgetOption, setWidgetOption] = useState({});

  useEffect(() => {
    axios
      .get('/data/dummyWidgetList.json')
      .then(response => setData(response.data.find(element => element.id === widget_id)));
  }, []);

  const dataSet = data.dataId;
  const widgetType = data.type;
  const prevOption = data.options;

  // 위젯 속성 저장
  const handleSubmit = event => {
    // datasetId , componentId, widgetTitle, option
    event.preventDefault();
    console.log('datesetId:', dataSet);
    console.log('widgetType:', widgetType);
    console.log('widgetOption:', widgetOption);
  };

  return (
    <PageContainer>
      <PageTitleBox title="위젯 수정" button={<ConfirmCancelButton confirmProps={{ onClick: handleSubmit }} />}>
        <WidgetAttributeSelect
          dataSetId={dataSet}
          componentType={widgetType}
          prevOption={prevOption}
          setWidgetOption={setWidgetOption}
        />
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetModify;
