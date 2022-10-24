import React, { useEffect, useState } from 'react';
import { Box, Card, IconButton, Stack } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { Link as RouterLink, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { useAlert } from 'react-alert';
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';
import DashboardService from '@/api/dashboardService';
import { STATUS } from '@/constant';

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
        <Card key={item.id} sx={{ width: '100%', height: '100%', borderRadius: 1 }}>
          <WidgetWrapper
            widgetOption={item}
            dataSetId={item.datasetId}
            sx={{ width: '100%', height: '100%', borderRadius: 1 }}
          />
        </Card>
      );
    });
  };

  const handleDialogSelect = detail => {
    if (detail == 1) {
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
    }
  };

  return (
    <PageTitleBox title="대시보드 조회">
      <TitleBox
        title={dashboardInfo.title}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRefreshClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to={`/dashboard/modify?id=${dashboardId}&name=${dashboardInfo.title}`}
              aria-label="수정"
            >
              <EditIcon />
            </IconButton>
            <DialogAlertIconButton size="small" icon={<Delete />} handleDialogSelect={handleDialogSelect}>
              {`'<${dashboardInfo.title}>'을(를) 삭제하시겠습니까?`}
            </DialogAlertIconButton>
          </Stack>
        }
      >
        <Box
          sx={{
            width: '1440px',
            minHeight: '1080px',
            borderRadius: 1,
            backgroundColor: '#eee',
          }}
        >
          <ResponsiveGridLayout rowHeight={54} compactType={null} cols={{ lg: 12 }} layouts={{ lg: layout }}>
            {generateWidget()}
          </ResponsiveGridLayout>
        </Box>
      </TitleBox>
    </PageTitleBox>
  );
};

export default DashboardView;
