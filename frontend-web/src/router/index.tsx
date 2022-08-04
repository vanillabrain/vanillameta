import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/Dashboard';
import Widget from '../pages/Widget';
import Data from '../pages/Data';
import DataConnect from '../pages/DataConnect';
import DataSet from '../pages/DataSet';
import Status404 from '../pages/Status404';
import WidgetCreate from '../pages/WidgetCreate';

function Router(props) {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/widget" element={<Widget />} />
      <Route path="/widget/create" element={<WidgetCreate />} />
      <Route path="/data" element={<Data />} />
      <Route path="/data/connect" element={<DataConnect />} />
      <Route path="/data/set" element={<DataSet />} />
      <Route path="/*" element={<Status404 />} />
    </Routes>
  );
}

export default Router;
