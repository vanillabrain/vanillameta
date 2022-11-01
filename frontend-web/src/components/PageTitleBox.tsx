import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

function PageTitleBox(props) {
  const { title, upperTitle, upperTitleLink = '', button, sx = {}, fixed } = props;
  const navigate = useNavigate();

  const defaultBoxSx = {
    minWidth: '900px',
    paddingLeft: '25px',
    paddingRight: '25px',
    width: '1920px',
    height: '100%',
  };

  const fixedSx = fixed && { position: 'fixed', zIndex: 1000 };

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
            ...fixedSx,
          }}
        >
          <Stack direction="row" gap="10px" alignItems="center">
            {upperTitle && (
              <>
                <Typography
                  component={RouterLink}
                  to={upperTitleLink}
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
                    textDecoration: 'none',
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
              component="button"
              onClick={event => {
                event.preventDefault();
                navigate(0);
              }}
              sx={{
                height: '19px',
                flexGrow: 0,
                border: 0,
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'Pretendard',
                fontSize: '16px',
                fontWeight: '600',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: 'normal',
                letterSpacing: 'normal',
                textAlign: 'left',
                textDecoration: 'none',
                color: '#141414',
                backgroundColor: 'transparent',
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
