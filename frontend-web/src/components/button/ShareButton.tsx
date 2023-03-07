import React, { createRef, forwardRef, Ref, useRef } from 'react';
import {
  Box,
  Button,
  ClickAwayListener,
  IconButton,
  Paper,
  Popper,
  Stack,
  SxProps,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ReactComponent as IconShare } from '@/assets/images/icon/ic-share.svg';
import { ReactComponent as IconToggleOn } from '@/assets/images/icon/toggle-on.svg';
import { ReactComponent as IconToggleOff } from '@/assets/images/icon/toggle-off.svg';
import { ReactComponent as IconLink } from '@/assets/images/icon/ic-link.svg';
import { useAlert } from 'react-alert';
import DatePicker from '@/components/form/DatePicker';

interface ShareButtonProps {
  handleShareToggle?: () => void;
  isShareOn?: boolean;
  shareId?: string;
  shareLimitDate?: string;
  setShareLimitDate?: React.Dispatch<React.SetStateAction<string>>;
}

interface SharePopupProps extends ShareButtonProps {
  matches: boolean;
}

const paperSx: SxProps = {
  marginTop: '3px',
  border: 'solid 1px #ddd',
  borderRadius: '6px',
  boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
};

const ShareOnPopup = forwardRef((props: SharePopupProps, ref: Ref<HTMLDivElement>) => {
  const { matches, handleShareToggle, shareLimitDate, shareId } = props;
  const alert = useAlert();
  const shareLink = `${process.env.PUBLIC_URL}/share/${shareId ? shareId : ''}`;

  const handleCopyClick = async () => {
    await navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        alert.success('클립보드에 링크가 복사되었습니다.');
      })
      .catch(error => {
        console.log(error);
        alert.error('링크 복사에 실패했습니다.\n다시 시도해 주세요.');
      });
  };

  return matches ? (
    <Paper sx={{ ...paperSx, minWidth: '410px' }} ref={ref}>
      <Stack sx={{ width: '100%', padding: '24px' }}>
        <Typography sx={{ mb: '6px', fontSize: '16px', fontWeight: 600, color: '#141414' }}>페이지 공유</Typography>
        <Stack
          component="form"
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb="3px"
        >
          <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>링크를 통한 읽기를 허용합니다.</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOn />
          </IconButton>
        </Stack>
        <Typography>
          설정하신&nbsp;
          <Box component="span" sx={{ color: '#0f5ab2' }}>
            {shareLimitDate}
          </Box>
          까지&nbsp;
          <Box component="span" sx={{ fontWeight: 600, color: '#0f5ab2' }}>
            공유중
          </Box>
          입니다.
        </Typography>
        <Stack direction="row" justifyContent="space-between" mt="18px">
          <TextField sx={{ width: '298px', height: '32px' }} disabled value={shareLink} />
          <Button variant="contained" sx={{ minWidth: '55px' }} onClick={handleCopyClick}>
            복사
          </Button>
        </Stack>
      </Stack>
    </Paper>
  ) : (
    <Paper sx={{ ...paperSx, width: '243px' }} ref={ref}>
      <Stack sx={{ width: '100%', p: '22px 24px 20px' }}>
        <Stack
          component="form"
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: '22px' }}
        >
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#141414' }}>페이지 공유 중</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOn />
          </IconButton>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: '14px', color: '#141414' }}>
            공유 기한:
            <Box component="span" sx={{ ml: '4px', fontWeight: 'bold', color: '#333' }}>
              {shareLimitDate}
            </Box>
          </Typography>
          <Button
            variant="contained"
            sx={{ width: '32px', minWidth: '32px', height: '32px', p: 0 }}
            onClick={handleCopyClick}
          >
            <IconLink />
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
});

const ShareOffPopup = forwardRef((props: SharePopupProps, ref: Ref<HTMLDivElement>) => {
  const { matches, handleShareToggle, shareLimitDate, setShareLimitDate } = props;

  return matches ? (
    <Paper sx={{ ...paperSx, minWidth: '410px' }} ref={ref}>
      <Stack sx={{ width: '100%', padding: '24px' }}>
        <Typography sx={{ mb: '6px', fontSize: '16px', fontWeight: 600, color: '#141414' }}>페이지 공유</Typography>
        <Stack
          component="form"
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb="16px"
        >
          <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>
            링크를 통한 읽기를 허용하지 않습니다.
          </Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOff />
          </IconButton>
        </Stack>
        <Stack sx={{ flexDirection: 'row', alignItems: 'center' }}>
          <Typography component="span" mr="8px">
            공유 기한:
          </Typography>
          <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
        </Stack>
      </Stack>
    </Paper>
  ) : (
    <Paper sx={{ ...paperSx, width: '243px' }} ref={ref}>
      <Stack sx={{ width: '100%', p: '22px 24px 20px' }}>
        <Stack
          component="form"
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: '22px' }}
        >
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#141414' }}>페이지 공유하지 않음</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOff />
          </IconButton>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: '14px', color: '#141414' }}>공유 기한:</Typography>
          <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
        </Stack>
      </Stack>
    </Paper>
  );
});

const shareOnButtonSx: SxProps = {
  flexShrink: 0,
  border: '1px solid #0f5ab2',
  backgroundColor: '#fff',
  color: '#0f5ab2',
  fill: '#0f5ab2',
  '& span': { mr: '6px' },
  '&:hover': { color: '#fff', fill: '#fff' },
};

const shareOffButtonSx: SxProps = {
  flexShrink: 0,
  fill: '#fff',
  '& span': { mr: '6px' },
  '&:hover': { border: '1px solid #0f5ab2', backgroundColor: '#fff', color: '#0f5ab2', fill: '#0f5ab2' },
};

function ShareButton(props: ShareButtonProps) {
  const { handleShareToggle, isShareOn, shareId, shareLimitDate, setShareLimitDate } = props;
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const ref: Ref<HTMLDivElement> = useRef();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <React.Fragment>
      {isShareOn ? (
        <Button
          startIcon={<IconShare fill="inherit" />}
          variant="contained"
          onClick={handleClick}
          sx={{
            ...shareOnButtonSx,
            px: { xs: '8px', sm: '12px' },
          }}
        >
          공유중
        </Button>
      ) : (
        <Button
          startIcon={<IconShare fill="inherit" />}
          variant="contained"
          onClick={handleClick}
          sx={{
            ...shareOffButtonSx,
            px: { xs: '8px', sm: '12px' },
          }}
        >
          공유
        </Button>
      )}
      <Popper id={id} open={open} anchorEl={anchorEl} disablePortal={false} placement="bottom-end">
        <ClickAwayListener onClickAway={handleClose}>
          {isShareOn ? (
            <ShareOnPopup
              ref={ref}
              matches={matches}
              handleShareToggle={handleShareToggle}
              shareLimitDate={shareLimitDate}
              shareId={shareId}
            />
          ) : (
            <ShareOffPopup
              ref={ref}
              matches={matches}
              handleShareToggle={handleShareToggle}
              shareLimitDate={shareLimitDate}
              setShareLimitDate={setShareLimitDate}
            />
          )}
        </ClickAwayListener>
      </Popper>
    </React.Fragment>
  );
}

export default ShareButton;
