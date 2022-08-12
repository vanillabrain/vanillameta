import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '../pages/Dashboard';
import Widget from '../pages/Widget';
import Data from '../pages/Data';
import DataSource from '../pages/Data/DataSource';
import DataSet from '../pages/Data/DataSet';
import Status404 from '../pages/Status404';
import WidgetCreate from '../pages/Widget/WidgetCreate';
import WidgetView from '../pages/Widget/WidgetView';
import WidgetModify from '../pages/Widget/WidgetModify';
import DashboardView from '../pages/Dashboard/DashboardView';
import DashboardCreate from '../pages/Dashboard/DashboardCreate';
import DashboardModify from '../pages/Dashboard/DashboardModify';
import Recommend from '../pages/Data/Recommend';

function Router(props) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />}>
        <Route path=":id" element={<DashboardView />} />
      </Route>
      <Route path="/dashboard/create" element={<DashboardCreate />} />
      <Route path="/dashboard/modify" element={<DashboardModify />} />
      <Route path="/widget" element={<Widget />}>
        <Route path=":id" element={<WidgetView />} />
      </Route>
      <Route path="/widget/create" element={<WidgetCreate />} />
      <Route path="/widget/modify" element={<WidgetModify />} />
      <Route path="/data" element={<Data />} />
      <Route path="/data/connect" element={<DataSource />} />
      <Route path="/data/set" element={<DataSet />} />
      <Route path="/data/recommend" element={<Recommend />} />
      <Route path="/*" element={<Status404 />} />
    </Routes>
  );
}

export default Router;
