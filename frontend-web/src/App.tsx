import React from 'react';
import { CssBaseline } from '@mui/material';
import Layout from './layouts/Layout';
import Router from './router';

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
