import React, { useContext, useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import widgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import { LayoutContext } from '@/contexts/LayoutContext';

interface CustomizedState {
  from: string;
}

const WidgetModify = props => {
  const [searchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const navigate = useNavigate();
  const location = useLocation();
  const { fixLayout } = useContext(LayoutContext);

  const [loading, setLoading] = useState(false);

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
    icon: '',
  };

  const [widgetInfo, setWidgetInfo] = useState<WidgetInfo>(defaultWidgetInfo);

  useEffect(() => {
    getWidgetInfo();
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  /**
   * 위젯 조회
   */
  const getWidgetInfo = () => {
    setLoading(true);
    // get('/data/dummyWidgetList.json')
    widgetService
      .selectWidget(widgetId)
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
        upperTitle="위젯"
        title="위젯 편집"
        sx={{ padding: 0 }}
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
          widgetOption={widgetInfo}
          saveWidgetInfo={saveWidgetInfo}
        />
      </PageTitleBox>
    </PageContainer>
  );
};

export default WidgetModify;
