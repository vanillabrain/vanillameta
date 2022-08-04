import React, { useEffect, useState } from 'react';
import { Box, Button, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const menuWidth = 200;

function DropMenuButton(props) {
  const theme = useTheme();
  const machesMd = useMediaQuery(theme.breakpoints.down('md'));

  // 1. props.naviUrl 이 있는 경우
  const [navigateUrl, setNavigateUrl] = useState('');
  const navigate = useNavigate();
  const handleNavigateClick = () => navigate(navigateUrl);

  useEffect(() => {
    setNavigateUrl(props.naviUrl);
  }, [navigateUrl]);

  // 2. props.menuList 가 있는 경우
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const bigButton = (
    <Button
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      variant="outlined"
      onClick={props.naviUrl ? handleNavigateClick : handleClick}
      sx={{ minWidth: { xs: 0 } }}
      startIcon={machesMd ? false : <AddIcon />}
    >
      {machesMd ? <AddIcon /> : '생성 바로가기'}
    </Button>
  );

  const smallButton = (
    <Button
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      variant="text"
      color="inherit"
      disableElevation
      onClick={props.naviUrl ? handleNavigateClick : handleClick}
      sx={{ minWidth: 0, p: 0.5 }}
    >
      <AddIcon />
    </Button>
  );

  console.log(props.menuList.label);

  return (
    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
      {props.button === 'big' ? bigButton : smallButton}

      <Menu
        id="styled-menu"
        MenuListProps={{
          'aria-labelledby': '추가 버튼',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{ width: menuWidth }}
      >
        {/*{props.menuList.map(item => (*/}
        {/*  <MenuItem onClick={handleClose} disableRipple sx={{ width: menuWidth }}>*/}
        {/*    /!*<RouterLink to={item.url} />*!/*/}
        {/*  </MenuItem>*/}
        {/*))}*/}
      </Menu>
    </Box>
  );
}

export default DropMenuButton;
