import React, { useEffect, useState } from 'react';
import { Box, Card, IconButton, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PageTitleBox from '@/components/PageTitleBox';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';
import DashboardTitleBox from '../Components/DashboardTitleBox';
import ModifyButton from '@/components/button/ModifyButton';
import DeleteButton from '@/components/button/DeleteButton';
import ReloadButton from '@/components/button/ReloadButton';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardView = () => {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const alert = useAlert();

  const [loading, setLoading] = useState(false);

  const [dashboardInfo, setDashboardInfo] = useState({ title: '', widgets: [], layout: [] }); // dashboard 정보
  const [layout, setLayout] = useState([]); // grid layout
  // dashboard id

  // init useEffect
  useEffect(() => {
    getDashboardInfo(dashboardId);
  }, []);

  // dashboardInfo useEffect
  useEffect(() => {
    dashboardInfo.layout.map((item, index) => {
      if (item.i !== undefined) {
        item.i = item.i.toString();
      }
      item.static = true;
    });

    setLayout(dashboardInfo.layout);
  }, [dashboardInfo]);

  // dashboard info 조회
  const getDashboardInfo = id => {
    DashboardService.selectDashboard(id).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setDashboardInfo(response.data.data);
      } else {
        alert.error('조회 실패하였습니다.');
      }
    });
  };

  // refrech 버튼 클릭
  const handleRefreshClick = () => {
    navigate(0);
  };

  // widget 생성
  const generateWidget = () => {
    return dashboardInfo.widgets.map((item, index) => {
      return (
        <Card
          key={item.id}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            border: 'solid 1px #e2e2e2',
            backgroundColor: '#fff',
          }}
        >
          <WidgetWrapper
            widgetOption={item}
            dataSetId={item.datasetId}
            sx={{ width: '100%', height: '100%', borderRadius: 1 }}
          />
        </Card>
      );
    });
  };

  const handleDeleteSelect = () => {
    alert.success('삭제하겠습니까?', {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            DashboardService.deleteDashboard(dashboardId).then(response => {
              if (response.data.status == STATUS.SUCCESS) {
                alert.info('삭제되었습니다.', {
                  onClose: () => {
                    navigate('/dashboard');
                  },
                });
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
    <PageTitleBox title="대시보드 조회" sx={{ width: '100%', marginTop: '22px' }}>
      <DashboardTitleBox
        title={
          <Typography
            variant="subtitle1"
            component="span"
            sx={{
              fontWeight: 500,
              paddingLeft: '18px',
              height: '16px',
              fontFamily: 'Pretendard',
              fontSize: '18px',
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 0.89,
              letterSpacing: '-0.18px',
              textAlign: 'left',
              color: '#141414',
            }}
          >
            {dashboardInfo.title}
          </Typography>
        }
        button={
          <Stack direction="row" spacing={3} sx={{ marginRight: '20px' }}>
            <ReloadButton
              size="medium"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleRefreshClick();
              }}
            />
            <ModifyButton
              size="medium"
              component={RouterLink}
              to={`/dashboard/modify?id=${dashboardId}&name=${dashboardInfo.title}`}
            />
            <DeleteButton
              size="medium"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleDeleteSelect();
              }}
            />
          </Stack>
        }
      >
        <Box
          sx={{
            width: '1390px',
            minWidth: '1390px',
            minHeight: '1080px',
            backgroundColor: '#f9f9fa',
            borderRadius: '0px 0px 6px 6px',
          }}
        >
          <ResponsiveGridLayout
            rowHeight={88}
            compactType={null}
            cols={{ lg: 12 }}
            layouts={{ lg: layout }}
            containerPadding={{ lg: [24, 24] }}
            margin={{ lg: [24, 24] }}
          >
            {generateWidget()}
          </ResponsiveGridLayout>
        </Box>
      </DashboardTitleBox>
    </PageTitleBox>
  );
};

export default DashboardView;
