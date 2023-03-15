import React from 'react';
import { Avatar, Box, Divider, Stack, SxProps, Typography, useMediaQuery, useTheme } from '@mui/material';
import { MAX_WIDTH } from '@/constant';

interface PageViewBoxProps {
  iconName?: string;
  title?: string;
  titleElement?: React.ReactNode;
  date?: string;
  button?: React.ReactNode;
  sx?: SxProps;
  children?: React.ReactNode;
}

function PageViewBox(props: PageViewBoxProps) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  return matches ? <DesktopViewBox {...props} /> : <MobileViewBox {...props} />;
}
export default PageViewBox;

const MobileViewBox = props => {
  const { iconName, title, titleElement, date, button, sx } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          width: '100%',
          minHeight: '66px',
          px: '20px',
          backgroundColor: '#ffffff',
          ...sx,
        }}
      >
        <Stack direction="row" alignItems="center">
          {iconName && (
            <Avatar
              src={`/static/images/${iconName}`}
              sx={{
                width: '30px',
                height: '30px',
                marginRight: '12px',
                borderRadius: 0,
                objectFit: 'contain',
                backgroundColor: 'transparent',
              }}
            />
          )}
          <Stack direction="column" gap="4px" sx={{ mt: '18px', mb: '10px' }}>
            {titleElement ? (
              titleElement
            ) : (
              <Typography
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '3',
                  WebkitBoxOrient: 'vertical',
                  maxHeight: '60px',
                  pr: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: '#333',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  wordWrap: 'break-word',
                }}
              >
                {title}
              </Typography>
            )}
            {date && (
              <Typography sx={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.6, color: '#333' }}>
                수정일: {date}
              </Typography>
            )}
          </Stack>{' '}
        </Stack>

        {button}
      </Stack>
      <Box
        sx={{
          width: '100%',
          minWidth: '100%',
          height: '100%',
          flex: '1 1 auto',
          backgroundColor: '#f9f9fa',
        }}
      >
        <Divider sx={{ width: '100%', height: '1px' }} />
        {props.children}
      </Box>
    </Box>
  );
};

const DesktopViewBox = props => {
  const { iconName, title, titleElement, date, button, sx } = props;

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: '20px',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: MAX_WIDTH,
          height: '100%',
          borderRadius: '6px',
          border: 'solid 1px #ddd',
          backgroundColor: '#f9f9fa',
          ...sx,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ width: '100%', height: '57px', px: '20px', backgroundColor: '#ffffff', borderRadius: '6px 6px 0px 0px' }}
        >
          {/* title */}
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              width: '100%',
              maxWidth: { sm: `calc(100% - ${button ? 390 : 100}px)`, md: `calc(100% - ${button ? 360 : 100}px)` },
            }}
          >
            {iconName && (
              <Avatar
                src={`/static/images/${iconName}`}
                sx={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 0,
                  objectFit: 'contain',
                  backgroundColor: 'transparent',
                  mr: '18px',
                }}
              />
            )}
            {titleElement ? (
              titleElement
            ) : (
              <Typography
                variant="subtitle1"
                component="span"
                sx={{
                  flexGrow: 0,
                  display: 'block',
                  width: '100%',
                  maxWidth: MAX_WIDTH,
                  height: '16px',
                  fontWeight: 500,
                  fontSize: { xs: '16px', sm: '18px' },
                  lineHeight: 0.89,
                  letterSpacing: '-0.18px',
                  color: '#141414',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </Typography>
            )}
          </Stack>

          {/* date, button */}
          <Stack direction="row" justifyContent="flex-end" alignItems="center" flexShrink="0">
            <Box
              component="span"
              sx={{
                marginRight: button ? { sm: '26px', md: '36px' } : {},
                height: '16px',
                fontFamily: 'Pretendard',
                fontSize: '14px',
                fontWeight: '500',
                fontStretch: 'normal',
                fontStyle: 'normal',
                lineHeight: '1.14',
                letterSpacing: 'normal',
                textAlign: 'left',
                color: '#333333',
              }}
            >
              {date}
            </Box>
            <Stack direction="row" justifyContent="flex-end" alignItems="center">
              {button}
            </Stack>
          </Stack>
        </Stack>
        <Divider sx={{ width: '100%', height: '1px' }} />
        {props.children}
      </Box>
    </Box>
  );
};
