import React, { ReactElement } from 'react';
import { Hidden, Stack, SxProps, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

type PageTitleBox = {
  title: string;
  upperTitle?: string;
  upperTitleLink?: string;
  sx?: SxProps;
  button: ReactElement;
  fixed?: boolean;
};

function PageTitleBox(props) {
  const { title, upperTitle, upperTitleLink, button, sx, fixed } = props;
  const navigate = useNavigate();

  const defaultBoxSx = {
    flex: '1 1 auto',
    paddingLeft: '25px',
    paddingRight: '25px',
    width: '100%',
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
            // minWidth: '400px',
            height: { xs: 40, sm: 56 },
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
          {props.children}
        </Stack>
      </Stack>
    </Stack>
  );
}

PageTitleBox.defaultProps = {
  title: '',
  upperTitle: '',
};

export default PageTitleBox;
