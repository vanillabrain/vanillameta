import React from 'react';
import { Box, Button, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const menuList = ['데이터 소스', '데이터 셋', '위젯', '대시보드'];
const menuWidth = 200;

function DropMenu(props) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
      <Button
        id="추가 버튼"
        aria-controls={open ? 'styled-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        variant="contained"
        disableElevation
        onClick={handleClick}
        sx={{ minWidth: 0, p: 0.5 }}
      >
        <AddIcon />
      </Button>

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

export default DropMenu;
