import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageTitleBox from '@/components/PageTitleBox';
import { ConfirmButton } from '@/components/button/ConfirmCancelButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WidgetAttributeSelect from '@/pages/Widget/WidgetCreate/WidgetAttributeSelect';
import widgetService from '@/api/widgetService';
import { useQuery } from '@tanstack/react-query';
import { WidgetInfo } from '@/api/type';
import { LayoutContext } from '@/contexts/LayoutContext';
import { LoadingContext } from '@/contexts/LoadingContext';

interface CustomizedState {
  from: string;
}

const WidgetModify = () => {
  const { t } = useTranslation();
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

  const { data: savedWidget } = useQuery({
    queryKey: ['widget', widgetId],
    queryFn: () => widgetService.selectWidget(widgetId).then(response => response.data.data),
    enabled: !!widgetId,
  });

  useEffect(() => {
    fixLayout(true);
    return () => {
      fixLayout(false);
    };
  }, []);

  /**
   * 위젯 조회
   */
  useEffect(() => {
    if (savedWidget) setWidgetInfo(savedWidget);
  }, [savedWidget]);

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
      upperTitle={t('widget.title')}
      upperTitleLink="/widget"
      title={t('widget.editTitle')}
      sx={{ padding: 0 }}
      button={
        <ConfirmButton
          confirmLabel={t('widget.save')}
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
