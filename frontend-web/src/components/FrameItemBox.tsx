import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import DropMenuButton from './DropMenuButton';

function FrameItemBox(props) {
  const title: string = props.title ? props.title : '';
  const minHeight: number = props.minHeight ? props.minHeight : '100%';

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
        {props.menuList || props.menuNavigate ? (
          <DropMenuButton menuList={props.menuList || false} menuNavigate={props.menuNavigate || false} />
        ) : (
          ''
        )}
      </Stack>
      <Divider sx={{ marginBottom: 3 }} />
      {props.children}
    </Box>
  );
}

export default FrameItemBox;
