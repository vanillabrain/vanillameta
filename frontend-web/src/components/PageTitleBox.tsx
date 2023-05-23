import React from 'react';
import { Hidden, Stack, SxProps, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

interface PageTitleBoxProps {
  title: string;
  upperTitle?: string;
  upperTitleLink?: string;
  sx?: SxProps;
  button?: React.ReactNode;
  fixed?: boolean;
  children: React.ReactNode;
}

function PageTitleBox(props: PageTitleBoxProps) {
  const { title, upperTitle, upperTitleLink, button, sx, fixed, children } = props;
  const navigate = useNavigate();

  const defaultBoxSx = {
    flex: '1 1 auto',
    paddingLeft: '25px',
    paddingRight: '25px',
    width: '100vw',
    height: '100%',
  };

  const fixedSx = fixed && { position: 'fixed', zIndex: 1000 };

  Object.assign(defaultBoxSx, sx);

  return (
    <Stack direction="column" sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>
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
            height: { xs: 40, sm: 56 },
            paddingLeft: '24px',
            paddingRight: '24px',
            borderBottom: '1px solid #e3e7ea',
            backgroundColor: '#f5f6f8',
            ...fixedSx,
          }}
        >
          <Stack direction="row" gap={{ xs: '6px', sm: '10px' }} alignItems="center">
            {upperTitle && (
              <>
                <Typography
                  component={RouterLink}
                  to={upperTitleLink}
                  sx={{
                    height: '19px',
                    flexGrow: 0,
                    fontFamily: 'Pretendard',
                    fontSize: { xs: '14px', sm: '16px' },
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
                    fontSize: 'inherit',
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
                fontSize: { xs: '14px', sm: '16px' },
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
          <Hidden smDown>{button}</Hidden>
        </Stack>
      </Stack>
      <Stack
        direction="column"
        sx={{ justifyContent: 'flex-start', flex: '1 1 auto', width: '100%', height: 'calc(100% - 56px)' }}
      >
        <Stack direction="column" sx={defaultBoxSx}>
          {children}
        </Stack>
      </Stack>
    </Stack>
  );
}

export default PageTitleBox;
