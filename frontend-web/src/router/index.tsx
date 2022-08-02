import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/Dashboard';
import Widget from '../pages/Widget';
import Data from '../pages/Data';
import DataConnect from '../pages/DataConnect';
import Status404 from '../pages/Status404';

function Router(props) {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/widget" element={<Widget />} />
      <Route path="/data" element={<Data />} />
      <Route path="/data/connect" element={<DataConnect />} />
      <Route path="/data/test" element={<Widget />} />
      <Route path="/*" element={<Status404 />} />
    </Routes>
  );
}

export default Router;
