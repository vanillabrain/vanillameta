import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import AddButton from './button/AddButton';

function TitleBox(props) {
  const title: string = props.title || '';
  const width = props.width || '100%';
  const menuList = props.menuList || false;
  const naviUrl = props.naviUrl || false;

  let button = null;
  if (menuList) {
    // menuList 가 있을 경우 onClick 시 menuList 가 펼쳐지는 dropMenu 버튼
    button = <AddButton menuList={menuList} />;
  } else if (naviUrl) {
    // naviUrl 이 있을 경우 onClick 시 naviUrl 로 이동하는 버튼
    button = <AddButton naviUrl={naviUrl} />;
  } else {
    button = props.button;
  }

  return (
    <Box
      sx={{
        width: width,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {button}
      </Stack>
      <Divider sx={{ marginBottom: 4 }} />
      {props.children}
    </Box>
  );
}

export default TitleBox;
