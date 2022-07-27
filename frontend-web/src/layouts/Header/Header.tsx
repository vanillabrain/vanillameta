import React from 'react';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Button,
  Stack,
  Link,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

import DropButton from '../../components/DropButton';
import Logo from './Logo';

function Header(props) {
  const headerHeight = props.height;
  const drawerWidth = 240;
  const navItems = [
    { id: 1, name: '대시보드', url: '/' },
    { id: 2, name: '위젯', url: 'widget' },
    { id: 3, name: '데이터', url: 'data' },
  ];

  const { window } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} mt={5} sx={{ textAlign: 'center' }}>
      {/*<Logo />*/}
      {/*<Divider />*/}
      <List>
        {navItems.map(item => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton href={item.url} sx={{ textAlign: 'center' }}>
              <ListItemText primary={item.name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const container = window !== undefined ? () => window().document.body : undefined;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar elevation={0} component="nav">
        <Toolbar variant="dense" sx={{ height: headerHeight, justifyContent: 'space-between', columnGap: '80px' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Logo />
          <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', sm: 'flex', flexGrow: 1 } }}>
            {navItems.map(item => (
              <Button href={item.url} size="large" key={item.id} sx={{ color: 'inherit' }}>
                {item.name}
              </Button>
            ))}
          </Stack>
          <DropButton />
        </Toolbar>
        <Divider />
      </AppBar>

      <Box component="nav">
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
    </Box>
  );
}

export default Header;
