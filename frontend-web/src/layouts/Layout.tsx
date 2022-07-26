import React from 'react';
import { Box } from '@mui/material';

import Header from './Header/Header';
import Footer from './Footer/Footer';

function Layout(props) {
  const headerHeight = 60;

  return (
    <React.Fragment>
      <Header height={headerHeight} />
      <Box sx={{ marginTop: headerHeight + 'px' }}>{props.children}</Box>
      <Footer />
    </React.Fragment>
  );
}

export default Layout;
