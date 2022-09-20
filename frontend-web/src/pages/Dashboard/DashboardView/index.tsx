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

const DashboardView = props => {
  const location = useLocation();
  const match = useMatch('/dashboard/:dashboard_id');
  const [dashboardInfo, setDashboardInfo] = useState({ title: '', widgets: [] });

  const [dashboardId, setDashboardId] = useState(null);

  const ReactGridLayout = WidthProvider(RGL);
  const layout = [
    {
      x: 0,
      y: 0,
      w: 6,
      h: 2,
      i: '0',
      static: true,
    },
    {
      x: 6,
      y: 0,
      w: 6,
      h: 3,
      i: '1',
      static: true,
    },
  ];
  useEffect(() => {
    setDashboardId(match.params.dashboard_id);
    getDashboardInfo(match.params.dashboard_id);
  }, []);

  const getDashboardInfo = id => {
    get('/data/dummyDashboardInfo.json').then(response => {
      setDashboardInfo(response.data);
    });
  };

  const handleRenewClick = () => {
    console.log('renew');
  };

  const generateWidget = () => {
    console.log('generateWidget', dashboardInfo.widgets);
    return dashboardInfo.widgets.map((item, index) => {
      console.log('data', item);
      return (
        <Card key={index} sx={{ width: '100%', height: '100%', borderRadius: 1 }}>
          <WidgetWrapper
            widgetOption={item}
            dataSetId={item.dataSetId}
            sx={{ width: '100%', height: '100%', borderRadius: 1 }}
          />
        </Card>
      );
    });
  };

  return (
    <PageTitleBox title="대시보드 조회">
      <TitleBox
        title={dashboardInfo.title}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRenewClick} aria-label="새로고침" color="primary">
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
          <ReactGridLayout layout={layout}>{generateWidget()}</ReactGridLayout>
        </Box>
      </TitleBox>
    </PageTitleBox>
  );
};

export default DashboardView;
