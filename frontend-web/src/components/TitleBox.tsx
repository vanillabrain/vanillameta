import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import DropMenuButton from './DropMenuButton';

function TitleBox(props) {
  const title: string = props.title || '';
  const width = props.width || '100%';

  let button = null;
  if (props.menuList) {
    button = <DropMenuButton menuList={props.menuList} />;
  } else if (props.naviUrl) {
    button = <DropMenuButton naviUrl={props.naviUrl} />;
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
