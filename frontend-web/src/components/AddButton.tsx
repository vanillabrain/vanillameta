import React, { useEffect, useState } from 'react';
import { Box, Button, Menu, MenuItem, useMediaQuery, useTheme, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const menuWidth = 200;

function AddButton(props) {
  const theme = useTheme();
  const maches = useMediaQuery(theme.breakpoints.up('md'));

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

  const largeButton = (
    <Button
      {...props}
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      onClick={props.naviUrl ? handleNavigateClick : handleClick}
      startIcon={maches ? <AddIcon /> : false}
      variant="outlined"
      sx={{ minWidth: { xs: 0 } }}
    >
      {maches ? '생성 바로가기' : <AddIcon />}
    </Button>
  );

  const smallButton = (
    <Button
      {...props}
      id="추가 버튼"
      aria-controls={open ? 'styled-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      disableElevation
      onClick={props.naviUrl ? handleNavigateClick : handleClick}
      color="primary"
      // size="medium"
      sx={{ minWidth: { xs: 0 } }}
    >
      <AddIcon sx={{ width: 28, height: 28, m: 0 }} />
      {/*<AddIcon />*/}
    </Button>
  );

  return (
    <Box>
      {props.label ? largeButton : smallButton}

      {props.menuList && (
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
          {props.menuList.map(item => (
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
