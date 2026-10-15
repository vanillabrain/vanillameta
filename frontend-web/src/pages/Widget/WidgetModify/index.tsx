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
import { useAlert } from 'react-alert';
import { STATUS } from '@/constant';

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
  const alert = useAlert();

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

  const { data: savedWidget, isError } = useQuery({
    queryKey: ['widget', widgetId],
    queryFn: () =>
      widgetService.selectWidget(widgetId).then(response => {
        if (response.data.status !== STATUS.SUCCESS || !response.data.data?.id) {
          throw new Error(response.data.message || t('widget.loadFailed'));
        }
        return response.data.data;
      }),
    enabled: !!widgetId,
    retry: false,
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
    setWidgetInfo(savedWidget && !isError ? savedWidget : defaultWidgetInfo);
    if (isError) alert.error(t('widget.loadFailed'));
  }, [savedWidget, isError, widgetId]);

  const saveWidgetInfo = async (option, title): Promise<boolean> => {
    const param = {
      title: title,
      option: option,
    };
    console.log(option, 'option');
    showLoading();
    try {
      const response = await widgetService.updateWidget(widgetInfo.id, param);
      if (response.data.status === STATUS.SUCCESS) {
        navigate((location.state as CustomizedState)?.from || '/widget');
        return true;
      }
      alert.error(response.data.message || t('common.genericError'));
      return false;
    } catch (error) {
      alert.error(error.response?.data?.message || error.message || t('common.genericError'));
      return false;
    } finally {
      hideLoading();
    }
  };

  return (
    <PageTitleBox
      upperTitle={t('widget.title')}
      upperTitleLink="/widget"
      title={t('widget.editTitle')}
      className="p-0"
      button={
        <ConfirmButton
          confirmLabel={t('widget.save')}
          confirmProps={{
            form: 'widgetAttribute',
            type: 'submit',
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
