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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { AddMenuButton } from '@/components/button/AddIconButton';
import Logo from './Logo';
import NavBar from './NavBar';

const menuList = [
  { name: '데이터 소스', link: '/data/source/create' },
  { name: '데이터 셋', link: '/data/set/create' },
  { name: '위젯', link: '/widget/create' },
  { name: '대시보드', link: '/dashboard/create?createType=dashboard' },
];

function Header(props) {
  const headerHeight = props.height;
  const drawerWidth = 240;

  const navItems = [
    { id: 1, name: '대시보드', link: 'dashboard' },
    { id: 2, name: '위젯', link: 'widget' },
    { id: 3, name: '데이터', link: 'data' },
  ];

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} mt={5} sx={{ textAlign: 'center' }}>
      <List>
        {navItems.map(item => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton sx={{ textAlign: 'center' }}>
              <ListItemText primary={item.name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

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

          <NavBar navItems={navItems} />
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <AddMenuButton label="생성 바로가기" menuList={menuList} />
          </Box>
        </Toolbar>
        <Divider />
      </AppBar>

      <Box component="nav">
        <Drawer
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
