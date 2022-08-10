import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';

import Dashboard from '../pages/Dashboard';
import Widget from '../pages/Widget';
import Data from '../pages/Data';
import DataSource from '../pages/DataSource';
import DataSet from '../pages/DataSet';
import Status404 from '../pages/Status404';
import WidgetCreate from '../pages/WidgetCreate';
import WidgetView from '../pages/WidgetView';
import WidgetModify from '../pages/WidgetModify';

function Router(props) {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/widget" element={<Widget />}>
        <Route path=":id" element={<WidgetView />} />
      </Route>
      <Route path="/widget/create" element={<WidgetCreate />} />
      <Route path="/widget/modify" element={<WidgetModify />} />
      <Route path="/data" element={<Data />} />
      <Route path="/data/connect" element={<DataSource />} />
      <Route path="/data/set" element={<DataSet />} />
      <Route path="/*" element={<Status404 />} />
    </Routes>
  );
}

export default Router;
