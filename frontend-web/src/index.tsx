import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import './index.css';

const queryClient = new QueryClient();

if (import.meta.env.REACT_APP_SENTRY_DSN) {
  void import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn: import.meta.env.REACT_APP_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: Number(import.meta.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || 0),
    });
  });
}

const rootElement = document.getElementById('root');
const app = (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LayoutProvider>
        <LoadingProvider>
          <BrowserRouter>
            <AuthProvider>
              <TooltipProvider>
                <AlertProvider>
                  <App />
                </AlertProvider>
              </TooltipProvider>
            </AuthProvider>
          </BrowserRouter>
        </LoadingProvider>
      </LayoutProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootElement, app); // react pre-rendering
} else {
  ReactDOM.createRoot(rootElement).render(app);
}
