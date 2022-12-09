import React, { useContext, useEffect, useState } from 'react';
import { Avatar, Card, Stack, Typography } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import ReloadButton from '@/components/button/ReloadButton';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import DashboardTitleBox from '@/pages/Dashboard/Components/DashboardTitleBox';
import { useAlert } from 'react-alert';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import Seo from '@/seo/Seo';
import { dateData } from '@/utils/util';

const WidgetView = () => {
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

  const { widgetId } = useParams();

  useEffect(() => {
    getWidgetInfo();
  }, []);

  /**
   * 위젯 조회
   */
  const getWidgetInfo = () => {
    showLoading();
    WidgetService.selectWidget(widgetId)
      .then(response => {
        setWidgetOption(response.data.data);
      })
      .finally(() => {
        hideLoading();
      });
  };

  // refrech 버튼 클릭
  const handleRefreshClick = () => {
    navigate(0);
  };

  const removeWidget = () => {
    alert.success(`${widgetOption.title}\n위젯을 삭제하시겠습니까?`, {
      title: '위젯 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            showLoading();
            WidgetService.deleteWidget(widgetId)
              .then(response => {
                if (response.status === 200) {
                  navigate('/widget', { replace: true });
                  snackbar.success('위젯이 삭제되었습니다.');
                } else {
                  alert.error('위젯 삭제에 실패했습니다.\n다시 시도해 주세요.');
                }
              })
              .finally(() => {
                hideLoading();
              });
          },
        },
      ],
    });
  };

  return (
    <PageTitleBox upperTitle="위젯" upperTitleLink="/widget" title="위젯 조회" sx={{ width: '100%', marginTop: '22px' }}>
      <Seo title={widgetOption.title} />
      <DashboardTitleBox
        sx={{ minWidth: '600px', maxWidth: '1392px', width: '95%' }}
        title={
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              pl: '20px',
            }}
          >
            <Avatar
              src={`/static/images/${widgetOption.icon}`}
              sx={{ width: '30px', height: '30px', borderRadius: 0, objectFit: 'contain', backgroundColor: 'transparent' }}
            />
            <Typography
              variant="subtitle1"
              component="span"
              sx={{
                fontWeight: 500,
                paddingLeft: '14px',
                height: '16px',
                fontSize: '18px',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: 0.89,
                letterSpacing: '-0.18px',
                textAlign: 'left',
                color: '#141414',
              }}
            >
              {widgetOption.componentTitle}
            </Typography>
          </Stack>
        }
        button={
          <Stack direction="row" alignItems="center" sx={{ marginRight: '20px' }}>
            <span
              style={{
                marginRight: '56px',
                height: '16px',
                fontSize: '14px',
                fontWeight: '500',
                lineHeight: '1.14',
                letterSpacing: 'normal',
                textAlign: 'left',
                color: '#333',
              }}
            >
              {dateData(widgetOption.updatedAt)}
            </span>
            <ReloadButton
              size="medium"
              sx={{ marginRight: '36px', padding: 0 }}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleRefreshClick();
              }}
            />
            <ModifyButton
              size="medium"
              sx={{ marginRight: '36px', padding: 0 }}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                navigate(`/widget/modify?id=${widgetId}&title=${widgetOption.title}`, { state: { from: pathname } });
              }}
            />
            <DeleteButton
              size="medium"
              sx={{ padding: 0 }}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                removeWidget();
              }}
            />
          </Stack>
        }
      >
        <Card
          sx={{
            width: '60%',
            height: '50vw',
            minHeight: '300px',
            maxHeight: '700px',
            margin: '54px auto',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            border: 'solid 1px #e2e2e2',
            backgroundColor: '#fff',
          }}
        >
          <WidgetWrapper widgetOption={widgetOption} dataSetId={widgetOption.datasetId} />
        </Card>
      </DashboardTitleBox>
    </PageTitleBox>
  );
};

export default WidgetView;
