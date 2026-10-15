import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import ReloadButton from '@/components/button/ReloadButton';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import PageViewBox from '@/components/PageViewBox';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';
import { STATUS } from '@/constant';
import { Card } from '@/components/ui/card';

const WidgetView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
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
  const [widgetOption, setWidgetOption] = useState<WidgetInfo>(defaultWidgetInfo);
  const [loadError, setLoadError] = useState(false);

  const { widgetId } = useParams();

  useEffect(() => {
    return getWidgetInfo();
  }, [widgetId]);

  /**
   * 위젯 조회
   */
  const getWidgetInfo = () => {
    let active = true;
    setWidgetOption(defaultWidgetInfo);
    setLoadError(false);
    showLoading();
    WidgetService.selectWidget(widgetId)
      .then(response => {
        if (!active) return;
        const widget = response.data.data;
        if (response.data.status === STATUS.SUCCESS && widget && typeof widget === 'object' && Number(widget.id) > 0) {
          setWidgetOption(widget);
        } else {
          setWidgetOption(defaultWidgetInfo);
          setLoadError(true);
        }
      })
      .catch(() => {
        if (active) {
          setWidgetOption(defaultWidgetInfo);
          setLoadError(true);
        }
      })
      .finally(() => {
        hideLoading();
      });
    return () => {
      active = false;
    };
  };

  // refrech 버튼 클릭
  const handleRefreshClick = () => {
    navigate(0);
  };

  const removeWidget = () => {
    alert.success(
      <>
        <span className="font-semibold">{widgetOption.title}</span>
        <br />
        {t('widget.deleteConfirm')}
      </>,
      {
        title: t('widget.deleteTitle'),
        closeCopy: t('data.cancel'),
        actions: [
          {
            copy: t('data.delete'),
            onClick: () => {
              showLoading();
              WidgetService.deleteWidget(widgetId)
                .then(response => {
                  if (response.data.status === STATUS.SUCCESS) {
                    navigate('/widget', { replace: true });
                    snackbar.success(t('widget.deleted'));
                  } else {
                    alert.error(t('widget.deleteFailed'));
                  }
                })
                .catch(() => {
                  alert.error(t('widget.deleteFailed'));
                })
                .finally(() => {
                  hideLoading();
                });
            },
          },
        ],
      },
    );
  };

  return (
    <PageTitleBox
      upperTitle={t('widget.title')}
      upperTitleLink="/widget"
      title={t('widget.view')}
      className="w-full flex-auto p-0"
    >
      <Seo title={widgetOption.title} />
      <PageViewBox
        iconName={widgetOption.icon}
        title={widgetOption.componentTitle}
        date={dateData(widgetOption.updatedAt)}
        button={
          <div className="hidden sm:contents">
            <ReloadButton
              className="mr-9 p-0"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleRefreshClick();
              }}
            />
            <ModifyButton
              className="mr-9 p-0"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                navigate(`/widget/modify?id=${widgetId}&title=${widgetOption.title}`, { state: { from: pathname } });
              }}
            />
            <DeleteButton
              className="p-0"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                removeWidget();
              }}
            />
          </div>
        }
      >
        <Card className="mx-auto my-6 h-[50vw] max-h-[700px] min-h-[300px] w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-background shadow-none ring-0 sm:my-8">
          {loadError ? (
            <p role="alert" className="p-6 text-center">
              {t('share.widgetFetchFailed')}
            </p>
          ) : widgetOption.id ? (
            <WidgetWrapper widgetOption={widgetOption} dataSetId={widgetOption.datasetId} />
          ) : null}
        </Card>
      </PageViewBox>
    </PageTitleBox>
  );
};

export default WidgetView;
