import React, { useEffect, useState } from 'react';
import { Box, Button, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const menuWidth = 200;

function AddButton(props) {
  const naviUrl = props.naviUrl || false;
  const menuList = props.menuList || false;
  const label = props.label || false;

  const [anchorEl, setAnchorEl] = useState(null);
  const [navigateUrl, setNavigateUrl] = useState('');
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    if (naviUrl) {
      setNavigateUrl(naviUrl);
    }
  }, [navigateUrl]);

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleNavigateClick = () => {
    navigate(navigateUrl);
  };

  const largeButton = (
    <Button
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      onClick={naviUrl ? handleNavigateClick : handleClick}
      startIcon={matches ? <AddIcon /> : false}
      variant="outlined"
      sx={{ minWidth: { xs: 0 } }}
    >
      {matches ? label : <AddIcon />}
    </Button>
  );

  const smallButton = (
    <Button
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      disableElevation
      onClick={naviUrl ? handleNavigateClick : handleClick}
      color="primary"
      sx={{ minWidth: { xs: 0 } }}
    >
      <AddIcon sx={{ width: 28, height: 28, m: 0 }} />
    </Button>
  );

  return (
    <Box>
      {label ? largeButton : smallButton}

      {menuList && (
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
          {menuList.map(item => (
            <MenuItem
              key={item.label}
              component={RouterLink}
              to={item.url}
              onClick={handleClose}
              disableRipple
              sx={{ width: menuWidth }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
}

export default AddButton;
