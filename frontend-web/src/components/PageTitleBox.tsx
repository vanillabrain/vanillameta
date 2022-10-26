import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

function PageTitleBox(props) {
  const { title, upperTitle, button, sx = {} } = props;

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
          <Stack direction="row" gap="10px" alignItems="center">
            {upperTitle && (
              <React.Fragment>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 500,
                    paddingLeft: '18px',
                    height: '16px',
                    fontFamily: 'Pretendard',
                    fontSize: '16px',
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: 0.89,
                    letterSpacing: '-0.18px',
                    textAlign: 'left',
                    color: '#141414',
                  }}
                >
                  {upperTitle}
                </Typography>
                <span>/</span>
              </React.Fragment>
            )}
            <Typography
              component="span"
              sx={{
                height: '19px',
                fontSize: '16px',
                fontWeight: 'bold',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: 'normal',
                letterSpacing: 'normal',
                textAlign: 'left',
                color: '#141414',
              }}
            >
              {title}
            </Typography>
          </Stack>
          {button}
        </Stack>
      </Stack>
      <Box sx={{ width: '100%', height: 'calc(100% - 56px)', display: 'flex', justifyContent: 'center' }}>
        <Box sx={defaultBoxSx}>{props.children}</Box>
      </Box>
    </Box>
  );
}

PageTitleBox.defaultProps = {
  title: '',
  upperTitle: '',
};

export default PageTitleBox;
