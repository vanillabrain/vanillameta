import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';

function PageTitleBox(props) {
  const { title, button } = props;

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

PageTitleBox.defaultProps = {
  title: '',
  button: undefined,
};

export default PageTitleBox;
