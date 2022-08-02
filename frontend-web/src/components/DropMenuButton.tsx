import React, { useEffect, useState } from 'react';
import { Box, Button, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

const menuWidth = 200;

function DropMenuButton(props) {
  // 1. props.menuList 가 있는 경우
  const menuList = props.menuList ? props.menuList : ['메뉴'];

  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  // 2. props.menuNavigate 이 있는 경우
  const [navigateUrl, setNavigateUrl] = useState('');
  const navigate = useNavigate();
  const handleNavigateClick = () => navigate(navigateUrl);

  useEffect(() => {
    setNavigateUrl(props.menuNavigate);
    console.log(props.menuNavigate);
  }, [navigateUrl]);

  const bigButton = (
    <Button
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      variant="contained"
      disableElevation
      onClick={props.menuNavigate ? handleNavigateClick : handleClick}
      sx={{ minWidth: 0, p: 0.5 }}
    >
      <AddIcon />
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
      onClick={props.menuNavigate ? handleNavigateClick : handleClick}
      sx={{ minWidth: 0, p: 0.5 }}
    >
      <AddIcon />
    </Button>
  );

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
        {menuList.map(menu => (
          <MenuItem key={menu} onClick={handleClose} disableRipple sx={{ width: menuWidth }}>
            {menu}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

export default DropMenuButton;
