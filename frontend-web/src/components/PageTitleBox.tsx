import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';

function PageTitleBox(props) {
  const { title, button, sx = null } = props;

  const defaultBoxSx = {
    minWidth: '900px',
    paddingLeft: '25px',
    paddingRight: '25px',
    width: '1920px',
    height: '100%',
  };

  Object.assign(defaultBoxSx, sx);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Stack
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
            height: 56,
            paddingLeft: '24px',
            paddingRight: '24px',
            backgroundColor: '#f5f6f8',
          }}
        >
          <Typography
            component="span"
            sx={{
              height: '19px',
              fontFamily: 'Pretendard',
              fontSize: '16px',
              fontWeight: 'bold',
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              textAlign: 'left',
              color: '#4a4a4a',
            }}
          >
            {title}
          </Typography>
          {button}
        </Stack>
      </Stack>
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Box sx={defaultBoxSx}>{props.children}</Box>
      </Box>
    </Box>
  );
}

PageTitleBox.defaultProps = {
  title: '',
  button: undefined,
};

export default PageTitleBox;
