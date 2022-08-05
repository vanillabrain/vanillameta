import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';
import ConfirmButton from './ConfirmButton';

function PageTitleBox(props) {
  const title: string = props.title ? props.title : '';
  const minHeight: number = props.minHeight ? props.minHeight : '100%';

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
          py: 1,
        }}
      >
        <Typography variant="h5" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        <ConfirmButton disabled={props.disabled} />
      </Stack>
      <Divider sx={{ marginBottom: 5 }} />
      {props.children}
    </Box>
  );
}

export default PageTitleBox;
