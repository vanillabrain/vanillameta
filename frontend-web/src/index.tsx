import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import theme from './theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import { HelmetProvider } from 'react-helmet-async';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';
import './index.css';

const rootElement = document.getElementById('root');
const app = (
  <HelmetProvider>
    <PerformanceProvider>
      <LayoutProvider>
        <LoadingProvider>
          <BrowserRouter>
            <AuthProvider>
              <ThemeProvider theme={theme}>
                <AlertProvider>
                  <App />
                </AlertProvider>
              </ThemeProvider>
            </AuthProvider>
          </BrowserRouter>
        </LoadingProvider>
      </LayoutProvider>
    </PerformanceProvider>
  </HelmetProvider>
);

if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootElement, app); // react pre-rendering
} else {
  ReactDOM.createRoot(rootElement).render(app);
}

// Register service worker for offline support and caching
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // When a new version is available, you can show a notification to the user
    console.log('New version available! Please refresh the page.');
    // You can trigger an update notification here
  },
  onSuccess: (registration) => {
    console.log('Service Worker registered successfully!');
  },
});

// Start measuring web vitals
reportWebVitals();
