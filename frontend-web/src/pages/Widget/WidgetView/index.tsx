import React from 'react';
import { Box, Button, ButtonGroup, Grid, Icon, IconButton, Stack } from '@mui/material';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EditIcon from '@mui/icons-material/Edit';
import { Delete } from '@mui/icons-material';
import PageTitleBox from '../../../components/PageTitleBox';
import TitleBox from '../../../components/TitleBox';
import { DialogAlertIconButton } from '../../../components/button/DialogAlertButton';

function WidgetView(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const widgetId = searchParams.get('id');
  const widgetName = searchParams.get('name');

  const handleRenewClick = () => {
    console.log('renew');
  };

  return (
    <PageTitleBox title="위젯 조회">
      <TitleBox
        title={widgetName}
        button={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleRenewClick} aria-label="새로고침" color="primary">
              <AutorenewIcon />
            </IconButton>
            <IconButton component={RouterLink} to={`/widget/modify?id=${widgetId}&name=${widgetName}`} aria-label="수정">
              <EditIcon />
            </IconButton>
            <DialogAlertIconButton icon={<Delete />} size="small">
              {`삭제시 N개의 대시보드에 반영됩니다.`}
              <br /> {`<${widgetName}>을 삭제하시겠습니까?`}
            </DialogAlertIconButton>
          </Stack>
        }
      >
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </TitleBox>
    </PageTitleBox>
  );
}

export default WidgetView;
