import React from 'react';
import { Box, Button, ClickAwayListener, IconButton, Paper, Popper, Stack, TextField, Typography } from '@mui/material';
import { ReactComponent as IconShare } from '@/assets/images/icon/ic-share.svg';
import { ReactComponent as IconToggleOn } from '@/assets/images/icon/toggle-on.svg';
import { ReactComponent as IconToggleOff } from '@/assets/images/icon/toggle-off.svg';
import { useAlert } from 'react-alert';
import { ROUTE_URL } from '@/constant';
import DatePicker from '@/components/form/DatePicker';

const ShareButton = ({ onClick, isShareOn, shareToken, shareLimitDate, setShareLimitDate }) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;
  const shareLink = `${ROUTE_URL}/share/${shareToken ? shareToken : ''}`;
  const alert = useAlert();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

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

  return (
    <React.Fragment>
      {isShareOn ? (
        <Button
          startIcon={<IconShare fill="inherit" />}
          variant="contained"
          sx={{
            px: '12px',
            border: '1px solid #0f5ab2',
            backgroundColor: '#fff',
            color: '#0f5ab2',
            fill: '#0f5ab2',
            '& span': { mr: '6px' },
            '&:hover': { color: '#fff', fill: '#fff' },
          }}
          onClick={handleClick}
        >
          공유중
        </Button>
      ) : (
        <Button
          startIcon={<IconShare fill="inherit" />}
          variant="contained"
          sx={{
            px: '12px',
            fill: '#fff',
            '& span': { mr: '6px' },
            '&:hover': { border: '1px solid #0f5ab2', backgroundColor: '#fff', color: '#0f5ab2', fill: '#0f5ab2' },
          }}
          onClick={handleClick}
        >
          공유
        </Button>
      )}
      <Popper id={id} open={open} anchorEl={anchorEl} disablePortal={false} placement="bottom-end">
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            sx={{
              display: 'flex',
              gap: '32px',
              minWidth: '410px',
              width: '410px',
              mt: '3px',
              p: '24px',
              border: 'solid 1px #ddd',
              borderRadius: '6px',
              boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
            }}
          >
            <Stack sx={{ width: '100%' }}>
              <Typography sx={{ mb: '6px', fontSize: '16px', fontWeight: 600, color: '#141414' }}>페이지 공유</Typography>
              {isShareOn ? (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb="6px">
                    <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>
                      링크를 통한 읽기를 허용합니다.
                    </Typography>
                    <IconButton onClick={onClick} sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
                      <IconToggleOn />
                    </IconButton>
                  </Stack>
                  <Typography>{shareLimitDate ? shareLimitDate : '??/??/????'} 까지 공유중</Typography>

                  <Stack direction="row" justifyContent="space-between" mt="29px">
                    <TextField sx={{ width: '298px', height: '32px' }} disabled value={shareLink} />
                    <Button variant="contained" sx={{ minWidth: '55px' }} onClick={handleCopyClick}>
                      복사
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb="10px">
                    <Typography sx={{ mr: '12px', fontSize: '14px', color: '#141414' }}>
                      링크를 통한 읽기를 허용하지 않습니다.
                    </Typography>
                    <IconButton onClick={onClick} sx={{ minWidth: '44px', width: '44px', height: '24px', m: 0, p: 0 }}>
                      <IconToggleOff />
                    </IconButton>
                  </Stack>
                  <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
                </Box>
              )}
            </Stack>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </React.Fragment>
  );
};

export default ShareButton;
