import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '@/pages/Dashboard';
import Widget from '@/pages/Widget';
import Data from '@/pages/Data';
import DataSource from '@/pages/Data/DataSource';
import DataSet from '@/pages/Data/DataSet';
import Status404 from '@/pages/Status404';
import WidgetCreate from '@/pages/Widget/WidgetCreate';
import WidgetView from '@/pages/Widget/WidgetView';
import WidgetModify from '@/pages/Widget/WidgetModify';
import DashboardView from '@/pages/Dashboard/DashboardView';
import DashboardCreate from '@/pages/Dashboard/DashboardCreate';
import DashboardModify from '@/pages/Dashboard/DashboardModify';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import Layout from '@/layouts/Layout';
import Login from '@/pages/Login';
import Share from '@/pages/Share';

function Router() {
  return (
    <Routes>
      <Route path="/share/:dashboardUuid" element={<Share />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace={true} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:dashboardId" element={<DashboardView />} />
        <Route path="/dashboard/create" element={<DashboardCreate />}>
          <Route path=":createType" element={<DashboardCreate />} />
        </Route>
        <Route path="/dashboard/modify" element={<DashboardModify />}>
          <Route path=":dashboardId" element={<DashboardModify />} />
        </Route>
        <Route path="/widget" element={<Widget />} />
        <Route path="/widget/:widgetId" element={<WidgetView />} />
        <Route path="/widget/create" element={<WidgetCreate />} />
        <Route path="/widget/modify" element={<WidgetModify />}>
          <Route path=":widgetId" element={<WidgetModify />} />
        </Route>

        <Route path="/data" element={<Data />} />
        <Route path="/data/source/create" element={<DataSource />} />
        <Route path="/data/source/modify" element={<DataSource />}>
          <Route path=":sourceId" element={<DataSource />} />
        </Route>

        <Route path="/data/set/create" element={<DataSet />}>
          <Route path=":sourceId" element={<DataSet />} />
        </Route>
        <Route path="/data/set/modify" element={<DataSet />}>
          <Route path=":setId" element={<DataSet />} />
        </Route>
      </Route>
      <Route path="/login" element={<Login />} />
      {/*<Route path="/signup" element={<SignUp />} />*/}
      <Route path="/*" element={<Status404 />} />
    </Routes>
  );
}

export default Router;
