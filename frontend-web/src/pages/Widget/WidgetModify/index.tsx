import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import axios from 'axios';

function WidgetModify(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const widgetName = searchParams.get('name');

  const [isLoaded, setIsLoaded] = useState(false);

  const [data, setData] = useState({
    dataId: 0,
    type: '',
    options: {},
  });
  const [widgetOption, setWidgetOption] = useState({});

  useEffect(() => {
    axios
      .get('/data/dummyWidgetList.json')
      .then(response => setData(response.data.find(element => element.id === widgetId)))
      .then(() => setIsLoaded(true));
  }, []);

  console.log(data, 'data');

  // 위젯 속성 저장
  const handleSubmit = event => {
    // datasetId , componentId, widgetTitle, option
    event.preventDefault();
    console.log('datesetId:', data.dataId);
    console.log('widgetType:', data.type);
    console.log('widgetOption:', data.options);
  };

  return (
    <PageContainer>
      <PageTitleBox title="위젯 수정" button={<ConfirmCancelButton confirmProps={{ onClick: handleSubmit }} />}>
        {isLoaded ? (
          <WidgetAttributeSelect
            dataSetId={data.dataId}
            componentType={data.type}
            prevOption={data.options}
            setWidgetOption={setWidgetOption}
          />
        ) : (
          ''
        )}
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetModify;
