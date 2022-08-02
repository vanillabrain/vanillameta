import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/Dashboard/index';
import Widget from '../pages/Widget/index';
import Data from '../pages/Data/index';

function Router() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="widget" element={<Widget />} />
      <Route path="data" element={<Data />} />
    </Routes>
  );
}

export default Router;
