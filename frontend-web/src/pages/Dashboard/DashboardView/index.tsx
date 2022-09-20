import React, { useEffect, useState } from 'react';
import { Box, Card, IconButton, Stack } from '@mui/material';
import { Link as RouterLink, useLocation, useMatch, useSearchParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';
import WidgetWrapper from '@/widget/wrapper/WidgetWrapper';
import { get } from '@/helpers/apiHelper';
import BoardListItem from '@/components/BoardListItem';
import RGL, { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardView = props => {
  const location = useLocation();
  const match = useMatch('/dashboard/:dashboard_id');
  const [dashboardInfo, setDashboardInfo] = useState({ title: '', widgets: [], layout: [] });

  const [dashboardId, setDashboardId] = useState(null);

  const ReactGridLayout = WidthProvider(RGL);

  useEffect(() => {
    setDashboardId(match.params.dashboard_id);
    getDashboardInfo(match.params.dashboard_id);
  }, []);

  const getDashboardInfo = id => {
    get('/data/dummyDashboardInfo.json').then(response => {
      setDashboardInfo(response.data);
    });
  };

  const handleRefreshClick = () => {
    getDashboardInfo(match.params.dashboard_id);
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
            <DialogAlertIconButton size="small" icon={<DeleteIcon />}>
              {`<${dashboardInfo.title}>을 삭제하시겠습니까?`}
            </DialogAlertIconButton>
          </Stack>
        }
      >
        <Box
          sx={{
            width: '1280px',
            minHeight: '1080px',
            borderRadius: 1,
            backgroundColor: '#eee',
          }}
        >
          <ResponsiveGridLayout layout={dashboardInfo.layout} rowHeight={54} compactType={null} cols={{ lg: 18 }}>
            {dashboardInfo.widgets.map((item, index) => {
              return (
                <Card key={index}>
                  <WidgetWrapper data={item} />
                </Card>
              );
            })}
          </ResponsiveGridLayout>
        </Box>
      </TitleBox>
    </PageTitleBox>
  );
};

export default DashboardView;
