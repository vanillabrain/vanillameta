import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import axios from 'axios';
// import { get } from '@/helpers/apiHelper';

function WidgetModify(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const widgetName = searchParams.get('name');

  const [isLoaded, setIsLoaded] = useState(false);

  const [data, setData] = useState({
    dataId: 0,
    type: '',
    option: {},
  });
  const [widgetOption, setWidgetOption] = useState({});

  useEffect(() => {
    axios
      .get('/data/dummyWidgetList.json')
      .then(response => response.data)
      .then(data => setData(data.find(element => element.id === widgetId)))
      .then(() => setIsLoaded(true));
  }, []);

  console.log(data, 'data');

  // 위젯 속성 저장
  const handleSubmit = event => {
    // datasetId , componentId, widgetTitle, option
    event.preventDefault();
    console.log('datesetId:', data.dataId);
    console.log('widgetType:', data.type);
    console.log('widgetOption:', data.option);
  };

  return (
    <PageContainer>
      <PageTitleBox title="위젯 수정" button={<ConfirmCancelButton confirmProps={{ onClick: handleSubmit }} />}>
        {isLoaded ? (
          <WidgetAttributeSelect
            dataSetId={data.dataId}
            componentType={data.type}
            prevOption={data.option}
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
