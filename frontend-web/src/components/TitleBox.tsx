import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import AddButton from './AddButton';

function TitleBox(props) {
  const title: string = props.title || '';
  const width = props.width || '100%';

  let button = null;
  if (props.menuList) {
    button = <AddButton menuList={props.menuList} />;
  } else if (props.naviUrl) {
    button = <AddButton naviUrl={props.naviUrl} />;
  } else {
    button = props.button;
  }

  // let button = undefined;
  // if (props.menuList) {
  //   button = <AddButton menuList={props.menuList} />;
  // } else if (props.naviUrl) {
  //   button = <AddButton naviUrl={props.naviUrl} />;
  // } else if (props.button) {
  //   button = props.button;
  // } else {
  //   return;
  // }

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
