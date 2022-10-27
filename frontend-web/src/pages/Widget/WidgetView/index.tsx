import React, { useEffect, useState } from 'react';
import { Avatar, Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetService from '@/api/widgetService';
import { WidgetInfo } from '@/api/type';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import ReloadButton from '@/components/button/ReloadButton';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import DashboardTitleBox from '@/pages/Dashboard/Components/DashboardTitleBox';
import { useAlert } from 'react-alert';

const WidgetView = () => {
  const navigate = useNavigate();
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
  const [widgetOption, setWidgetOption] = useState<WidgetInfo>(defaultWidgetInfo);

  const { widgetId } = useParams();
  const [loading, setLoading] = useState(false);

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
        setWidgetOption(response.data.data);
      })
      .finally(() => setLoading(false));
    // .then(data => setLoadedWidgetData(data.filter((list, idx) => idx <= 10 * loadedCount)));
  };

  const dateData = data => {
    let result = '';
    if (data != '') {
      const userDate = new Date(data);
      const year = userDate.getFullYear();
      const month = userDate.getMonth() + 1;
      const date = userDate.getDate();
      result = `${year}.${month >= 10 ? month : '0' + month}.${date >= 10 ? date : '0' + date}`;
    }
    return result;
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
            WidgetService.deleteWidget(widgetId).then(response => {
              if (response.status === 200) {
                navigate('/widget', { replace: true });
              } else {
                alert.info('삭제 실패하였습니다.');
              }
            });
          },
        },
      ],
    });
  };

  return (
    <PageTitleBox upperTitle="위젯" title="위젯 조회" sx={{ width: '100%', marginTop: '22px' }}>
      <DashboardTitleBox
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
              component={RouterLink}
              to={`/widget/modify?id=${widgetId}&name=${widgetOption.title}`}
              aria-label="수정"
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
        <Box
          sx={{
            width: '60%',
            height: '500px',
            margin: '54px auto',
            border: '1px solid #e2e2e2',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            backgroundColor: '#fff',
          }}
        >
          <WidgetWrapper
            widgetOption={widgetOption}
            dataSetId={widgetOption.datasetId}
            sx={{ width: '100%', height: '500px', borderRadius: 1 }}
          />
        </Box>
      </DashboardTitleBox>
    </PageTitleBox>
  );
};

export default WidgetView;
