import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import WidgetService from '@/api/widgetService';
import widgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';

// import { get } from '@/helpers/apiHelper';

interface CustomizedState {
  from: string;
}

const WidgetModify = props => {
  const [searchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  // const widgetName = searchParams.get('name');
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);

  // const [isLoaded, setIsLoaded] = useState(false);
  //
  // const [data, setData] = useState({
  //   dataId: 11,
  //   type: '',
  //   option: {},
  // });
  // const [widgetOption, setWidgetOption] = useState({});
  //
  // useEffect(() => {
  //   console.log(widgetId, widgetName);
  //   // axios
  //   //   .get('/data/dummyWidgetList.json')
  //   //   .then(response => response.data)
  //   //   .then(data => setData(data.find(element => element.id === widgetId)))
  //   //   .then(() => setIsLoaded(true));
  // }, []);
  //
  // console.log(data, 'data');
  //
  // // 위젯 속성 저장
  // const handleSubmit = event => {
  //   // dataSetId , componentId, widgetTitle, option
  //   event.preventDefault();
  //   console.log('datesetId:', data.dataId);
  //   console.log('widgetType:', data.type);
  //   console.log('widgetOption:', data.option);
  // };

  const defaultWidgetInfo: WidgetInfo = {
    componentId: '',
    createdAt: '',
    datasetId: '',
    datasetType: '',
    delYn: '',
    description: '',
    id: '',
    option: '',
    title: '',
    updatedAt: '',
    widgetViewId: '',
  };

  const [widgetInfo, setWidgetInfo] = useState<WidgetInfo>(defaultWidgetInfo);

  useEffect(() => {
    getWidgetInfo();
  }, []);

  /**
   * 위젯 조회
   */
  const getWidgetInfo = () => {
    setLoading(true);
    // get('/data/dummyWidgetList.json')
    WidgetService.selectWidget(widgetId)
      .then(response => {
        setWidgetInfo(response.data.data);
        console.log('getWidgetInfo', response.data.data);
      })
      .finally(() => setLoading(false));
    // .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
  };

  const saveWidgetInfo = (option, title) => {
    const param = {
      title: title,
      description: title,
      databaseId: 1,
      componentId: widgetInfo.componentId,
      // 'DATASET', 'WIDGET_VIEW'
      datasetType: 'DATASET',
      datasetId: '0001',
      tableName: '',
      option: option,
    };
    console.log(option);
    widgetService.updateWidget(widgetInfo.id, param).then(response => {
      navigate((location.state as CustomizedState).from || '/');
    });
  };

  return (
    <PageContainer>
      <PageTitleBox
        title="위젯 수정"
        button={
          <ConfirmButton
            confirmLabel="저장"
            confirmProps={{
              form: 'widgetAttribute',
              type: 'submit',
              variant: 'contained',
            }}
          />
        }
      >
        <WidgetAttributeSelect
          isModifyMode={true}
          dataSetId={widgetInfo.datasetId}
          widgetInfo={widgetInfo}
          saveWidgetInfo={saveWidgetInfo}
        />
      </PageTitleBox>
    </PageContainer>
  );
};

export default WidgetModify;
