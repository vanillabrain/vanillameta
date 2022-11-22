import React from 'react';
import { Avatar, Badge, Box, Button, Popover, Stack, Typography } from '@mui/material';
import { ReactComponent as IconUser } from '@/assets/images/icon/ic-user.svg';
import { Link as RouterLink } from 'react-router-dom';

const UserInfoButton = ({ handleSelect = null, iconUrl = IconUser }) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

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
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        sx={{
          '& .MuiPaper-root': {
            display: 'flex',
            gap: '32px',
            width: '360px',
            p: '24px',
            border: 'solid 1px #ddd',
            borderRadius: '6px',
            boxShadow: '2px 2px 9px 0 rgba(42, 50, 62, 0.1), 0 4px 4px 0 rgba(0, 0, 0, 0.02)',
          },
        }}
      >
        <Badge>
          <Avatar sx={{ width: '48px', height: '48px', border: '1px solid #ececec', backgroundColor: '#f5f6f8' }}>
            <IconUser />
          </Avatar>
        </Badge>
        <Stack>
          <Typography sx={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '18px', color: '#141414' }}>
            username
            <Box component="span" sx={{ ml: '4px', color: '#767676' }}>
              님
            </Box>
          </Typography>
          <Typography sx={{ mt: 1, fontSize: '14px', lineHeight: '20px', color: '#141414' }}>username@gmail.com</Typography>
          <Stack>
            <Typography
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
              <Box
                component={RouterLink}
                to="/"
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'inherit',

                  '&:after': {
                    content: `""`,
                    width: '1px',
                    height: '10px',
                    backgroundColor: '#cccfd8',
                  },
                }}
              >
                로그아웃
              </Box>
              <Box component={RouterLink} to="/" sx={{ color: 'inherit' }}>
                회원정보수정
              </Box>
            </Typography>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
};

export default UserInfoButton;
