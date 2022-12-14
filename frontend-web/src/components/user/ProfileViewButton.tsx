import React, { useContext } from 'react';
import { Avatar, Box, Button, ClickAwayListener, Paper, Popper, Stack, Typography } from '@mui/material';
import { ReactComponent as IconUser } from '@/assets/images/icon/ic-user.svg';
import ProfileModify from '@/components/user/ProfileModify';
import { AuthContext } from '@/contexts/AuthContext';
import Logout from '@/components/user/Logout';

const ProfileViewButton = () => {
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
        aria-controls={open ? 'styled-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        color="primary"
        sx={{ minWidth: 0, padding: 0 }}
      >
        <Box component={IconUser} sx={{ width: '36px', height: '36px', p: '7.5px' }} />
      </Button>
      <Popper id={id} open={open} anchorEl={anchorEl} disablePortal={true} placement="bottom-end">
        <ClickAwayListener onClickAway={handleClickAway}>
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
                <Typography
                  component="div"
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    mt: '32px',
                    fontSize: '14px',
                    textAlign: 'center',
                    color: '#4a4a4a',
                  }}
                >
                  <Logout />
                  <ProfileModify />
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default ProfileViewButton;
