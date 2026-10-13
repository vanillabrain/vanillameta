import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/router/ProtectedRoute';
import Layout from '@/layouts/Layout';
import PublicLayout from '@/layouts/PublicLayout';

// 라우트별 코드 스플리팅: 페이지는 lazy chunk로 분리되어 초기 번들 축소
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const DashboardView = React.lazy(() => import('@/pages/Dashboard/DashboardView'));
const DashboardCreate = React.lazy(() => import('@/pages/Dashboard/DashboardCreate'));
const DashboardEdit = React.lazy(() => import('@/pages/Dashboard/DashboardEdit'));
const DashboardModify = React.lazy(() => import('@/pages/Dashboard/DashboardModify'));
const Widget = React.lazy(() => import('@/pages/Widget'));
const WidgetView = React.lazy(() => import('@/pages/Widget/WidgetView'));
const WidgetCreate = React.lazy(() => import('@/pages/Widget/WidgetCreate'));
const WidgetModify = React.lazy(() => import('@/pages/Widget/WidgetModify'));
const Data = React.lazy(() => import('@/pages/Data'));
const DataSource = React.lazy(() => import('@/pages/Data/DataSource'));
const DataSet = React.lazy(() => import('@/pages/Data/DataSet'));
const FileAnalysis = React.lazy(() => import('@/pages/Data/FileAnalysis'));
const Metric = React.lazy(() => import('@/pages/Data/Metric'));
const Login = React.lazy(() => import('@/pages/Login'));
const SignUp = React.lazy(() => import('@/pages/SignUp'));
const Share = React.lazy(() => import('@/pages/Share'));
const Embed = React.lazy(() => import('@/pages/Share/Embed'));
const Status404 = React.lazy(() => import('@/pages/Status404'));
const Explore = React.lazy(() => import('@/pages/Explore'));
const Commerce = React.lazy(() => import('@/pages/Commerce'));

function Router() {
  return (
    <Suspense fallback={null}>
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
          <Route path="/dashboard/:dashboardId/edit-charts" element={<DashboardEdit />} />
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

          <Route path="/explore" element={<Explore />} />
          <Route path="/data" element={<Data />} />
          <Route path="/commerce" element={<Commerce />} />
          <Route path="/commerce/:projectId" element={<Commerce />} />
          <Route path="/data/file" element={<FileAnalysis />} />
          <Route path="/data/metric" element={<Metric />} />
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
        <Route path="/embed/:dashboardUuid" element={<Embed />} />
        <Route path="/" element={<PublicLayout />}>
          <Route path="/share/:dashboardUuid" element={<Share />} />
          <Route path="*" element={<Status404 />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default Router;
