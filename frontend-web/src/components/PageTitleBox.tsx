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
            borderBottom: '1px solid #e3e7ea',
            backgroundColor: '#f5f6f8',
          }}
        >
          <Stack direction="row" gap="10px" alignItems="center">
            {upperTitle && (
              <>
                <Typography
                  component="span"
                  sx={{
                    height: '19px',
                    flexGrow: 0,
                    fontFamily: 'Pretendard',
                    fontSize: '16px',
                    fontWeight: '500',
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: 'normal',
                    letterSpacing: 'normal',
                    textAlign: 'left',
                    color: '#4a4a4a',
                  }}
                >
                  {upperTitle}
                </Typography>
                <span
                  style={{
                    height: '19px',
                    flexGrow: 0,
                    fontFamily: 'Pretendard',
                    fontSize: '16px',
                    fontWeight: '500',
                    fontStretch: 'normal',
                    fontStyle: 'normal',
                    lineHeight: 'normal',
                    letterSpacing: 'normal',
                    textAlign: 'left',
                    color: '#767676',
                  }}
                >
                  /
                </span>
              </>
            )}
            <Typography
              component="span"
              sx={{
                height: '19px',
                flexGrow: 0,
                fontFamily: 'Pretendard',
                fontSize: '16px',
                fontWeight: '600',
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
