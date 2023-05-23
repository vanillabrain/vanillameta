import React, { useContext, useEffect, useState } from 'react';
import PageTitleBox from '@/components/PageTitleBox';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import widgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';

interface CustomizedState {
  from: string;
}

const WidgetModify = () => {
  const [searchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const navigate = useNavigate();
  const location = useLocation();
  const { fixLayout } = useContext(LayoutContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

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
    componentTitle: '',
    componentDescription: '',
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
    showLoading();
    widgetService
      .selectWidget(widgetId)
      .then(response => {
        setWidgetInfo(response.data.data);
        // console.log(widgetInfo, 'widgetInfo');
      })
      .finally(() => {
        hideLoading();
      });
  };

  const saveWidgetInfo = (option, title) => {
    const param = {
      title: title,
      option: option,
    };
    console.log(option, 'option');
    showLoading();
    widgetService
      .updateWidget(widgetInfo.id, param)
      .then(() => {
        navigate((location.state as CustomizedState)?.from || '/widget');
      })
      .finally(() => {
        hideLoading();
      });
  };

  return (
    <PageTitleBox
      upperTitle="위젯"
      upperTitleLink="/widget"
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
        widgetTypeName={widgetInfo.componentTitle}
        widgetTypeDescription={widgetInfo.componentDescription}
        isModifyMode={true}
        dataSetId={widgetInfo.datasetId}
        widgetOption={widgetInfo}
        saveWidgetInfo={saveWidgetInfo}
      />
    </PageTitleBox>
  );
};

export default WidgetModify;
