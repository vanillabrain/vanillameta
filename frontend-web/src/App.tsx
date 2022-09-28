import React, { useEffect } from 'react';
import { CssBaseline } from '@mui/material';
import Layout from './layouts/Layout';
import Router from './router';
import 'tui-grid/dist/tui-grid.css'; // tui grid style file

function App() {
  return (
    <React.Fragment>
      <CssBaseline />
      <Layout>
        <Router />
      </Layout>
    </React.Fragment>
  );
}

export default App;
