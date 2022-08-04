import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import DropMenuButton from './DropMenuButton';

function TitleBox(props) {
  const title: string = props.title || '';

  return (
    <Box
      sx={{
        width: '100%',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {props.menuList || props.naviUrl ? (
          <DropMenuButton menuList={props.menuList || false} naviUrl={props.naviUrl || false} />
        ) : (
          ''
        )}
      </Stack>
      <Divider sx={{ marginBottom: 3 }} />
      {props.children}
    </Box>
  );
}

export default TitleBox;
