import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/Dashboard/Dashboard';
import Widget from '../pages/Widget/Widget';
// import Data from '../pages/Data/Data';
import Data2 from '../pages/Data/Data2';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="widget" element={<Widget />} />
        <Route path="data" element={<Data2 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
