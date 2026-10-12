import React, { useContext } from 'react';
import { Avatar, Box, Button, Paper, Popover, Stack, Typography } from '@mui/material';
import IconUser from '@/assets/images/icon/ic-user.svg?react';
import ProfileModify from '@/components/user/ProfileModify';
import { AuthContext } from '@/contexts/AuthContext';
import Logout from '@/components/user/Logout';
import { useTranslation } from 'react-i18next';

const ProfileViewButton = () => {
  const { t } = useTranslation();
  const { userState } = useContext(AuthContext);
  const [open, setOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(previousOpen => !previousOpen);
  };

  const handleClickAway = () => {
    setOpen(false);
  };

  const canBeOpen = open && Boolean(anchorEl);
  const id = canBeOpen ? 'transition-popper' : undefined;

  return (
    <>
      <Button
        id="styled-menu"
        aria-label={t('profile.menu')}
        aria-controls={id}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        color="primary"
        sx={{ minWidth: 0, padding: 0 }}
      >
        <Box component={IconUser} sx={{ width: '36px', height: '36px', p: '7.5px' }} />
      </Button>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClickAway}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-label': t('profile.menu') } }}
      >
        <Paper
          sx={{
            display: 'flex',
            gap: '32px',
            width: '360px',
            mt: '3px',
            p: '24px',
            border: 'solid 1px #ddd',
            borderRadius: '6px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
          }}
        >
          <Avatar sx={{ width: '48px', height: '48px', border: '1px solid #ececec', backgroundColor: '#f5f6f8' }}>
            <IconUser />
          </Avatar>
          <Stack>
            <Typography sx={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '18px', color: '#141414' }}>
              {userState.userId}
              <Box component="span" sx={{ ml: '4px', fontWeight: 'normal', color: '#767676' }}>
                님
              </Box>
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '14px', lineHeight: '20px', color: '#141414' }}>
              {userState.userEmail}
            </Typography>
            <Stack>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  mt: '32px',
                  fontSize: '14px',
                  textAlign: 'center',
                  color: '#4a4a4a',
                }}
              >
                <Logout
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': {
                      backgroundColor: 'transparent',
                      textDecoration: 'underline',
                    },
                  }}
                />
                <Box sx={{ width: '1px', height: '10px', mx: '12px', backgroundColor: '#cccfd8' }} />
                <ProfileModify />
              </Box>
            </Stack>
          </Stack>
        </Paper>
      </Popover>
    </>
  );
};

export default ProfileViewButton;
