import React, { useState } from 'react';
import { Button, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';

const menuWidth = 200;

const AddIconButton = ({ link, ...props }) => {
  return (
    <Button disableElevation component={RouterLink} to={link} color="primary" sx={{ minWidth: { xs: 0 } }} {...props}>
      <AddIcon sx={{ width: 28, height: 28, m: 0 }} />
    </Button>
  );
};

AddIconButton.defaultProps = {
  link: '',
};

export default AddIconButton;

export const AddMenuButton = ({ menuList, label, ...props }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <React.Fragment>
      <Button
        id="styled-menu"
        aria-controls={open ? 'styled-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        startIcon={matches ? <AddIcon /> : false}
        variant="outlined"
        sx={{ minWidth: { xs: 0 } }}
      >
        {matches ? label : <AddIcon />}
      </Button>
      <Menu id="styled-menu" anchorEl={anchorEl} open={open} onClose={handleClose} sx={{ width: menuWidth }}>
        {menuList.map(item => (
          <MenuItem
            key={item.name}
            component={RouterLink}
            to={item.link}
            onClick={handleClose}
            disableRipple
            sx={{ width: menuWidth }}
          >
            {item.name}
          </MenuItem>
        ))}
      </Menu>
    </React.Fragment>
  );
};
AddMenuButton.defaultProps = {
  menuList: {
    name: '',
    link: '',
  },
};

export const AddMenuIconButton = ({ menuList, ...props }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const theme = useTheme();

  return (
    <React.Fragment>
      <Button
        id="styled-menu"
        aria-controls={open ? 'styled-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        color="primary"
        sx={{ minWidth: { xs: 0 } }}
      >
        {<AddIcon />}
      </Button>
      <Menu id="styled-menu" anchorEl={anchorEl} open={open} onClose={handleClose} sx={{ width: menuWidth }}>
        {menuList.map(item => (
          <MenuItem
            key={item.name}
            component={RouterLink}
            to={item.link}
            onClick={handleClose}
            disableRipple
            sx={{ width: menuWidth }}
          >
            {item.name}
          </MenuItem>
        ))}
      </Menu>
    </React.Fragment>
  );
};
AddMenuIconButton.defaultProps = {
  menuList: {
    name: '',
    link: '',
  },
};
