import React from 'react';
import { CssBaseline } from '@mui/material';

import Layout from './layouts/Layout';
import Index from './router';

function App() {
  return (
    <React.Fragment>
      <CssBaseline />
      <Layout>
        <Index />
      </Layout>
    </React.Fragment>
  );
}

export default App;
