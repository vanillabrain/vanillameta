import React, { useContext } from 'react';
import { Avatar, Box, Button, ClickAwayListener, Paper, Popper, Stack, Typography } from '@mui/material';
import { ReactComponent as IconUser } from '@/assets/images/icon/ic-user.svg';
import { useAlert } from 'react-alert';
import ProfileModify from '@/pages/User/components/ProfileModify';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import authService from '@/api/authService';

const ProfileViewButton = () => {
  const { userState, onLogout } = useContext(AuthContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const alert = useAlert();
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

  const handleLogout = () => {
    showLoading();
    authService
      .signout()
      .then(response => {
        if (response.status === 201) {
          onLogout();
          alert.success('로그아웃 되었습니다.');
        }
      })
      .catch(error => {
        console.log(error);
        if (error.response.status === 401) {
          // 이미 refreshToken이 만료
          onLogout();
          alert.success('로그아웃 되었습니다.');
          return;
        }
        alert.error('로그아웃에 실패했습니다.\n다시 시도해 주세요.');
      })
      .finally(() => {
        hideLoading();
      });
  };

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
                  <Button
                    // component={RouterLink}
                    // to="/login"
                    onClick={handleLogout}
                    disableRipple
                    disableFocusRipple
                    disableTouchRipple
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minWidth: 0,
                      minHeight: 0,
                      m: 0,
                      p: 0,
                      gap: '12px',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      textDecoration: 'underline',
                      color: 'inherit',
                      '&:hover': {
                        textDecoration: 'underline',
                        backgroundColor: 'inherit',
                      },

                      '&:after': {
                        content: `""`,
                        width: '1px',
                        height: '10px',
                        backgroundColor: '#cccfd8',
                      },
                    }}
                  >
                    로그아웃
                  </Button>

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
