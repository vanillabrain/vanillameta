import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';

function TitleBox(props) {
  const { title, width, button } = props;

  return (
    <Box
      sx={{
        width: width,
        flex: '1 1 auto',
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

TitleBox.defaultProps = {
  title: '',
  width: '100%',
  menuList: false,
  naviUrl: false,
  button: false,
};

export default TitleBox;
