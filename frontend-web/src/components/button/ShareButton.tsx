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
import IconShare from '@/assets/images/icon/ic-share.svg?react';
import IconToggleOn from '@/assets/images/icon/toggle-on.svg?react';
import IconToggleOff from '@/assets/images/icon/toggle-off.svg?react';
import IconLink from '@/assets/images/icon/ic-link.svg?react';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { matches, handleShareToggle, shareLimitDate, shareId } = props;
  const alert = useAlert();
  const shareLink = `${window.location.origin}/share/${shareId ? shareId : ''}`;
  const embedCode = `<iframe src="${window.location.origin}/embed/${
    shareId ? shareId : ''
  }" width="100%" height="600" frameborder="0"></iframe>`;

  const handleCopyClick = async () => {
    await navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        alert.success(t('share.linkCopied'));
      })
      .catch(error => {
        console.log(error);
        alert.error(t('share.linkCopyFailed'));
      });
  };

  const handleEmbedCopyClick = async () => {
    await navigator.clipboard
      .writeText(embedCode)
      .then(() => {
        alert.success(t('share.embedCopied'));
      })
      .catch(error => {
        console.log(error);
        alert.error(t('share.embedCopyFailed'));
      });
  };

  return matches ? (
    <Paper sx={{ ...paperSx, minWidth: '410px' }} ref={ref}>
      <Stack sx={{ width: '100%', padding: '24px' }}>
        <Typography sx={{ mb: '6px', fontSize: '16px', fontWeight: 600, color: '#141414' }}>
          {t('share.pageShare')}
        </Typography>
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
          <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>{t('share.allowRead')}</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOn />
          </IconButton>
        </Stack>
        <Typography>
          {t('share.untilPrefix')}
          <Box component="span" sx={{ color: '#0f5ab2' }}>
            {shareLimitDate}
          </Box>
          {t('share.untilMiddle')}
          <Box component="span" sx={{ fontWeight: 600, color: '#0f5ab2' }}>
            {t('share.sharingTag')}
          </Box>
          {t('share.untilSuffix')}
        </Typography>
        <Stack direction="row" justifyContent="space-between" mt="18px">
          <TextField sx={{ width: '298px', height: '32px' }} disabled value={shareLink} />
          <Button variant="contained" sx={{ minWidth: '55px' }} onClick={handleCopyClick}>
            {t('share.copy')}
          </Button>
        </Stack>
        <Typography sx={{ mt: '16px', mb: '6px', fontSize: '13px', fontWeight: 600, color: '#141414' }}>
          {t('share.embedCode')}
        </Typography>
        <Stack direction="row" justifyContent="space-between">
          <TextField sx={{ width: '298px' }} size="small" multiline rows={3} disabled value={embedCode} />
          <Button variant="contained" sx={{ minWidth: '55px' }} onClick={handleEmbedCopyClick}>
            {t('share.copy')}
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
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#141414' }}>{t('share.sharing')}</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOn />
          </IconButton>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: '14px', color: '#141414' }}>
            {t('share.expiry')}
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
  const { t } = useTranslation();
  const { matches, handleShareToggle, shareLimitDate, setShareLimitDate } = props;

  return matches ? (
    <Paper sx={{ ...paperSx, minWidth: '410px' }} ref={ref}>
      <Stack sx={{ width: '100%', padding: '24px' }}>
        <Typography sx={{ mb: '6px', fontSize: '16px', fontWeight: 600, color: '#141414' }}>
          {t('share.pageShare')}
        </Typography>
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
          <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>{t('share.disallowRead')}</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOff />
          </IconButton>
        </Stack>
        <Stack sx={{ flexDirection: 'row', alignItems: 'center' }}>
          <Typography component="span" mr="8px">
            {t('share.expiry')}
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
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#141414' }}>{t('share.notSharing')}</Typography>
          <IconButton type="submit" sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
            <IconToggleOff />
          </IconButton>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: '14px', color: '#141414' }}>{t('share.expiry')}</Typography>
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

  const handleClose = event => {
    event.preventDefault();
    event.stopPropagation();
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
