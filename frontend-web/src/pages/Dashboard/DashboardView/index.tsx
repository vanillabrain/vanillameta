import React, { useEffect, useState } from 'react';
import { Box, IconButton, Stack, Card } from '@mui/material';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { Outlet, useParams } from 'react-router-dom';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import { get } from '@/helpers/apiHelper';
import GridLayout, { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardView = props => {
  const [dashboardInfo, setDashboardInfo] = useState({});
  const [dashboardName, setDashboardName] = useState('');
  const { dashboard_id } = useParams();
  const location = useLocation();

  console.log('대시보드 view 호출 ', dashboard_id);

  useEffect(() => {
    // dashboard 호출
    // todo 서비스 연결시 dashboard_id 값을 이용하여 호출
    getDashboardInfo(dashboard_id);
  }, []);

  useEffect(() => {
    console.log(dashboardInfo);
    setDashboardName(dashboardInfo['title']);
  }, [dashboardInfo]);

  // dashboard 조회
  const getDashboardInfo = dashboardId => {
    get('/data/dummyDashboardInfo.json')
      .then(response => response.data)
      .then(data => setDashboardInfo(data));
  };

  // 대시보드 재조회
  const handleRefreshClick = dashboardId => {
    getDashboardInfo(dashboard_id);
  };

  return (
    <PageTitleBox title="대시보드 조회">
      <TitleBox
        title={dashboardName}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRefreshClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to={`/dashboard/modify?id=${dashboard_id}&name=${dashboardName}`}
              aria-label="수정"
            >
              <EditIcon />
            </IconButton>
            <DialogAlertIconButton size="small" icon={<DeleteIcon />}>
              {`<${dashboardName}>을 삭제하시겠습니까?`}
            </DialogAlertIconButton>
          </Stack>
        }
      >
        {/*<Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }}>*/}
        <Box
          sx={{
            width: '1280px',
            minHeight: '1080px',
            borderRadius: 1,
            backgroundColor: '#eee',
          }}
        >
          <ResponsiveGridLayout rowHeight={54} compactType={null} cols={{ lg: 20 }}>
            {/*<Card key="a">a</Card>*/}
            {/*<Card key="b">b</Card>*/}
            {/*<Card key="c">c</Card>*/}
          </ResponsiveGridLayout>
        </Box>
      </TitleBox>
    </PageTitleBox>
  );
};

// widget 생성
const createWidgetElement = props => {
  console.log('위젯을 생성한다.');
  return (
    <>
      <Card key="a">a</Card>
    </>
  );
};

export default DashboardView;
