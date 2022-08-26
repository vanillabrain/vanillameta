import React from 'react';
import { Box, IconButton, Stack } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import { DialogAlertIconButton } from '@/components/button/DialogAlertButton';

function DashboardView(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardId = searchParams.get('id');
  const dashboardName = searchParams.get('name');

  const handleRenewClick = () => {
    console.log('renew');
  };

  return (
    <PageTitleBox title="대시보드 조회">
      <TitleBox
        title={dashboardName}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRenewClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to={`/dashboard/modify?id=${dashboardId}&name=${dashboardName}`}
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
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </TitleBox>
    </PageTitleBox>
  );
}

export default DashboardView;
