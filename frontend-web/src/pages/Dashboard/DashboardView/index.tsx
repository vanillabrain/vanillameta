import React, { useEffect, useState } from 'react';
import { Box, IconButton, Stack } from '@mui/material';
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

const DashboardView = props => {
  const location = useLocation();
  const match = useMatch('/dashboard/:dashboard_id');
  const [dashboardInfo, setDashboardInfo] = useState({ title: '', widgets: [] });

  const [dashboardId, setDashboardId] = useState(null);

  useEffect(() => {
    // console.log('dashboardId : ', match.params.dashboard_id);
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
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }}>
          {dashboardInfo.widgets.map(item => (
            <WidgetWrapper key={item.widgetId} data={item} />
          ))}
        </Box>
      </TitleBox>
    </PageTitleBox>
  );
};

export default DashboardView;
