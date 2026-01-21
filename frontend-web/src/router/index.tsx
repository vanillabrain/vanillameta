import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import Layout from '@/layouts/Layout';
import PublicLayout from '@/layouts/PublicLayout';
import { Loading } from '@/components/loading';
import { RouteTracker } from '@/router/RouteTracker';
import { RouteErrorBoundary } from '@/components/ErrorBoundary';

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
const AdminRoutes = lazy(() => import(/* webpackChunkName: "admin" */ '@/pages/Admin/AdminRoutes'));

// Loading fallback component
const PageLoading = () => <Loading in={true} style={{ opacity: 0.4 }} />;

function Router() {
  return (
    <>
      <RouteTracker />
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
            <Route 
              path="/dashboard" 
              element={
                <RouteErrorBoundary routeName="dashboard">
                  <Dashboard />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/dashboard/:dashboardId" 
              element={
                <RouteErrorBoundary routeName="dashboard-view">
                  <DashboardView />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/dashboard/create" 
              element={
                <RouteErrorBoundary routeName="dashboard-create">
                  <DashboardCreate />
                </RouteErrorBoundary>
              }
            >
              <Route path=":createType" element={<DashboardCreate />} />
            </Route>
            <Route 
              path="/dashboard/modify" 
              element={
                <RouteErrorBoundary routeName="dashboard-modify">
                  <DashboardModify />
                </RouteErrorBoundary>
              }
            >
              <Route path=":dashboardId" element={<DashboardModify />} />
            </Route>
            <Route 
              path="/widget" 
              element={
                <RouteErrorBoundary routeName="widget">
                  <Widget />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/widget/:widgetId" 
              element={
                <RouteErrorBoundary routeName="widget-view">
                  <WidgetView />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/widget/create" 
              element={
                <RouteErrorBoundary routeName="widget-create">
                  <WidgetCreate />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/widget/modify" 
              element={
                <RouteErrorBoundary routeName="widget-modify">
                  <WidgetModify />
                </RouteErrorBoundary>
              }
            >
              <Route path=":widgetId" element={<WidgetModify />} />
            </Route>

            <Route 
              path="/data" 
              element={
                <RouteErrorBoundary routeName="data">
                  <Data />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/data/source/create" 
              element={
                <RouteErrorBoundary routeName="data-source-create">
                  <DataSource />
                </RouteErrorBoundary>
              } 
            />
            <Route 
              path="/data/source/modify" 
              element={
                <RouteErrorBoundary routeName="data-source-modify">
                  <DataSource />
                </RouteErrorBoundary>
              }
            >
              <Route path=":sourceId" element={<DataSource />} />
            </Route>

            <Route 
              path="/data/set/create" 
              element={
                <RouteErrorBoundary routeName="data-set-create">
                  <DataSet />
                </RouteErrorBoundary>
              }
            >
              <Route path=":sourceId" element={<DataSet />} />
            </Route>
            <Route 
              path="/data/set/modify" 
              element={
                <RouteErrorBoundary routeName="data-set-modify">
                  <DataSet />
                </RouteErrorBoundary>
              }
            >
              <Route path=":setId" element={<DataSet />} />
            </Route>
            <Route path="/*" element={<Status404 />} />
          </Route>
          <Route 
            path="/login" 
            element={
              <RouteErrorBoundary routeName="login">
                <Login />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <RouteErrorBoundary routeName="signup">
                <SignUp />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path="/admin/*" 
            element={
              <RouteErrorBoundary routeName="admin">
                <AdminRoutes />
              </RouteErrorBoundary>
            } 
          />
          <Route path="/" element={<PublicLayout />}>
            <Route 
              path="/share/:dashboardUuid" 
              element={
                <RouteErrorBoundary routeName="share">
                  <Share />
                </RouteErrorBoundary>
              } 
            />
            <Route path="*" element={<Status404 />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default Router;
