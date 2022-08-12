import React from 'react';
import { Box, Button, ButtonGroup, Grid, Icon, IconButton, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitleBox from '../../../components/PageTitleBox';
import TitleBox from '../../../components/TitleBox';

const title = '위젯 조회';

function WidgetView(props) {
  const handleRenewClick = () => {
    console.log('renew');
  };

  const handleDeleteClick = () => {
    console.log('delete');
  };

  return (
    <PageTitleBox title={title} button={''}>
      <TitleBox
        title="위젯 이름"
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRenewClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton component={RouterLink} to="/widget/modify" aria-label="수정">
              <EditIcon />
            </IconButton>
            <IconButton onClick={handleDeleteClick} aria-label="수정">
              <DeleteIcon />
            </IconButton>
          </Stack>
        }
      >
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </TitleBox>
    </PageTitleBox>
  );
}

export default WidgetView;
