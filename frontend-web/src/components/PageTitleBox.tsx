import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import ConfirmButton from './ConfirmButton';
import AddButton from './AddButton';

function PageTitleBox(props) {
  const title: string = props.title || '';
  const naviUrl = props.naviUrl || false;

  let button = null;
  if (naviUrl) {
    // naviUrl 이 있을 경우 onClick 시 naviUrl 로 이동하는 버튼
    button = <AddButton naviUrl={naviUrl} />;
  } else if (props.button === 'confirm') {
    // button='confirm' 일 경우 confirm / cancel 선택 버튼, disabled 로 confirm 버튼 비활성
    button = <ConfirmButton primary={{ disabled: props.disabled }} />;
  } else {
    button = props.button;
  }

  return (
    <Box
      sx={{
        width: '100%',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          width: '100%',
          height: 63,
          py: 1,
        }}
      >
        <Typography variant="h5" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {button}
      </Stack>
      <Divider sx={{ marginBottom: 5 }} />
      {props.children}
    </Box>
  );
}

export default PageTitleBox;
