import React, { forwardRef, Ref } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Popover,
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
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100dvh - 96px)',
  overflowY: 'auto',
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
          <IconButton
            type="submit"
            role="switch"
            aria-checked={true}
            aria-label={t('share.allowRead')}
            sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}
          >
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
        <Stack direction="row" spacing={1} mt="18px">
          <TextField
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{ input: { readOnly: true }, htmlInput: { 'aria-label': t('share.pageShare') } }}
            value={shareLink}
          />
          <Button variant="contained" sx={{ minWidth: '55px', flexShrink: 0 }} onClick={handleCopyClick}>
            {t('share.copy')}
          </Button>
        </Stack>
        <Typography sx={{ mt: '16px', mb: '6px', fontSize: '13px', fontWeight: 600, color: '#141414' }}>
          {t('share.embedCode')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            sx={{
              flex: 1,
              minWidth: 0,
              height: 'auto',
              '& .MuiInputBase-root': { height: 'auto', bgcolor: 'background.default' },
              '& textarea': { overflowWrap: 'anywhere' },
            }}
            size="small"
            multiline
            minRows={3}
            maxRows={6}
            slotProps={{ input: { readOnly: true }, htmlInput: { 'aria-label': t('share.embedCode') } }}
            value={embedCode}
          />
          <Button variant="contained" sx={{ minWidth: '55px', flexShrink: 0 }} onClick={handleEmbedCopyClick}>
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
          <IconButton
            type="submit"
            role="switch"
            aria-checked={true}
            aria-label={t('share.allowRead')}
            sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}
          >
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
            aria-label={`${t('share.pageShare')} ${t('share.copy')}`}
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
          <IconButton
            type="submit"
            role="switch"
            aria-checked={false}
            aria-label={t('share.allowRead')}
            sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}
          >
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
          <IconButton
            type="submit"
            role="switch"
            aria-checked={false}
            aria-label={t('share.allowRead')}
            sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}
          >
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
  borderColor: 'primary.main',
  bgcolor: 'background.paper',
  color: 'primary.main',
  '& svg': { fill: 'currentColor' },
  '& span': { mr: '6px' },
  '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main' },
};

const shareOffButtonSx: SxProps = {
  flexShrink: 0,
  '& svg': { fill: 'currentColor' },
  '& span': { mr: '6px' },
  '&:hover': { bgcolor: 'primary.dark', color: 'primary.contrastText' },
};

function ShareButton(props: ShareButtonProps) {
  const { handleShareToggle, isShareOn, shareId, shareLimitDate, setShareLimitDate } = props;
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;
  const theme = useTheme();
  const { t } = useTranslation();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

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
          variant="outlined"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          onClick={handleClick}
          sx={{
            ...shareOnButtonSx,
            px: { xs: '8px', sm: '12px' },
          }}
        >
          {t('share.buttonActive')}
        </Button>
      ) : (
        <Button
          startIcon={<IconShare fill="inherit" />}
          variant="contained"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          onClick={handleClick}
          sx={{
            ...shareOffButtonSx,
            px: { xs: '8px', sm: '12px' },
          }}
        >
          {t('share.button')}
        </Button>
      )}
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-label': t('share.pageShare') } }}
        sx={{ zIndex: theme.zIndex.modal }}
      >
        {isShareOn ? (
          <ShareOnPopup
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            shareId={shareId}
          />
        ) : (
          <ShareOffPopup
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            setShareLimitDate={setShareLimitDate}
          />
        )}
      </Popover>
    </React.Fragment>
  );
}

export default ShareButton;
