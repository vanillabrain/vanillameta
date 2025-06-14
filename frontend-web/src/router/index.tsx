import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import Layout from '@/layouts/Layout';
import PublicLayout from '@/layouts/PublicLayout';
import { Loading } from '@/components/loading';

// Lazy load all page components with webpack magic comments for better chunk naming
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ '@/pages/Dashboard'));
const Widget = lazy(() => import(/* webpackChunkName: "widget" */ '@/pages/Widget'));
const Data = lazy(() => import(/* webpackChunkName: "data" */ '@/pages/Data'));
const DataSource = lazy(() => import(/* webpackChunkName: "data-source" */ '@/pages/Data/DataSource'));
const DataSet = lazy(() => import(/* webpackChunkName: "data-set" */ '@/pages/Data/DataSet'));
const Status404 = lazy(() => import(/* webpackChunkName: "status-404" */ '@/pages/Status404'));
const WidgetCreate = lazy(() => import(/* webpackChunkName: "widget-create" */ '@/pages/Widget/WidgetCreate'));
const WidgetView = lazy(() => import(/* webpackChunkName: "widget-view" */ '@/pages/Widget/WidgetView'));
const WidgetModify = lazy(() => import(/* webpackChunkName: "widget-modify" */ '@/pages/Widget/WidgetModify'));
const DashboardView = lazy(() => import(/* webpackChunkName: "dashboard-view" */ '@/pages/Dashboard/DashboardView'));
const DashboardCreate = lazy(() => import(/* webpackChunkName: "dashboard-create" */ '@/pages/Dashboard/DashboardCreate'));
const DashboardModify = lazy(() => import(/* webpackChunkName: "dashboard-modify" */ '@/pages/Dashboard/DashboardModify'));
const Login = lazy(() => import(/* webpackChunkName: "login" */ '@/pages/Login'));
const Share = lazy(() => import(/* webpackChunkName: "share" */ '@/pages/Share'));
const SignUp = lazy(() => import(/* webpackChunkName: "signup" */ '@/pages/SignUp'));

// Loading fallback component
const PageLoading = () => <Loading in={true} style={{ opacity: 0.4 }} />;

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
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
          <Route path="/*" element={<Status404 />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/" element={<PublicLayout />}>
          <Route path="/share/:dashboardUuid" element={<Share />} />
          <Route path="*" element={<Status404 />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default Router;
